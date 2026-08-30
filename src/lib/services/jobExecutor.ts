/**
 * Generation Job Execution Service
 *
 * Stateless execution engine for background paper generation jobs.
 * Handles payload synthesis, AbortSignal forwarding, processTestUpload dispatch,
 * biphasic similar paper generation execution, automated 429 rate limit exponential backoff countdowns,
 * and network disconnection handling.
 */

import { aiService } from '$lib/services/ai';
import { db, fireAndForget } from '$lib/services/db';
import { precompileQuestionsMath } from '$lib/services/mathHtmlCompiler';
import { processTestUpload } from '$lib/services/testUploader';
import type { PaperBlueprint } from '$lib/types/blueprint';
import type { GenerationJob } from '$lib/types/queue';
import { DEFAULT_SUBJECT_IDS } from '$lib/types/subject';
import type { TestItem, TestUploadPayload } from '$lib/types/test';
import { formatBytes } from '$lib/utils';

export interface ExecuteJobOptions {
	apiKey: string;
	isOnline: boolean;
	onProgress: (pct: number, statusText: string) => void;
	onSuccess: (createdTest: TestItem) => void;
	onCancel: () => void;
	onPausedOffline: () => void;
	onRateLimitBackoff: (
		countdownSeconds: number,
		nextRetryTimestamp: number,
		retryCount: number,
		maxRetries: number
	) => void;
	onRateLimitCountdown: (remainingSeconds: number) => void;
	onRateLimitRetryReady: () => void;
	onFailure: (errorMessage: string) => void;
}

/**
 * Coordinates biphasic generation for a similar paper job:
 * Phase 1 (0% - 45%): Extract blueprint or reuse cached blueprint
 * Phase 2 (45% - 90%): Generate new questions from blueprint
 * Post-processing (90% - 100%): KaTeX precompilation & Dexie database persistence
 */
async function executeSimilarPaperJob(
	job: GenerationJob,
	options: ExecuteJobOptions
): Promise<TestItem> {
	if (!job.sourceTestId) {
		throw new Error('Missing sourceTestId for similar paper generation job.');
	}

	// 1. Load source test from IndexedDB
	const sourceTest = await db.tests.get(job.sourceTestId);
	if (!sourceTest) {
		throw new Error(`Source test with ID "${job.sourceTestId}" was not found in the database.`);
	}

	if (!sourceTest.questions || sourceTest.questions.length === 0) {
		throw new Error(`Source test "${sourceTest.title}" contains no questions to analyze.`);
	}

	if (job.abortController?.signal.aborted) {
		throw new DOMException('Operation cancelled by user', 'AbortError');
	}

	// 2. Phase 1: Blueprint Extraction (0% - 45%)
	let blueprint: PaperBlueprint | undefined = job.blueprintCache || sourceTest.blueprint;

	if (blueprint) {
		options.onProgress(45, 'Reusing cached paper blueprint analysis...');
	} else {
		options.onProgress(5, 'Phase 1/2: Analyzing source paper patterns & reverse-engineering blueprint...');

		const blueprintResult = await aiService.generatePaperBlueprint({
			provider: job.aiProvider,
			apiKey: options.apiKey,
			model: job.aiModel,
			sourceTest,
			signal: job.abortController?.signal,
			onProgress: (statusText, pct) => {
				const mappedPct = pct ? Math.min(45, Math.round(5 + (pct / 100) * 40)) : 25;
				options.onProgress(mappedPct, `[Phase 1 Blueprint] ${statusText}`);
			},
		});

		blueprint = blueprintResult.blueprint;

		// Cache blueprint on source test in IndexedDB
		sourceTest.blueprint = blueprint;
		fireAndForget(
			db.updateTestBlueprint(sourceTest.id, blueprint),
			`Caching blueprint on source test "${sourceTest.title}"`
		);

		// Cache on in-memory job
		job.blueprintCache = blueprint;
		fireAndForget(
			db.updateJobBlueprintCache(job.id, blueprint),
			`Caching blueprint on generation job "${job.id}"`
		);
	}

	if (job.abortController?.signal.aborted) {
		throw new DOMException('Operation cancelled by user', 'AbortError');
	}

	// 3. Phase 2: Generate Similar Paper from Blueprint (45% - 90%)
	const targetQuestionCount =
		job.targetQuestionCount || job.questionCount || sourceTest.questions.length || 10;

	options.onProgress(
		48,
		`Phase 2/2: Synthesizing ${targetQuestionCount} original questions from blueprint...`
	);

	const similarResult = await aiService.generateSimilarPaper({
		provider: job.aiProvider,
		apiKey: options.apiKey,
		model: job.aiModel,
		blueprint,
		sourceTestTitle: sourceTest.title,
		customInstructions: job.customInstructions,
		targetQuestionCount,
		durationMinutes: job.durationMinutes ?? sourceTest.durationMinutes,
		isUntimed: job.isUntimed ?? (sourceTest.durationMinutes === null),
		signal: job.abortController?.signal,
		onProgress: (statusText, pct) => {
			const mappedPct = pct ? Math.min(90, Math.round(48 + (pct / 100) * 42)) : 70;
			options.onProgress(mappedPct, `[Phase 2 Generation] ${statusText}`);
		},
	});

	if (job.abortController?.signal.aborted) {
		throw new DOMException('Operation cancelled by user', 'AbortError');
	}

	// 4. Post-processing & Synthesis (90% - 100%)
	options.onProgress(92, 'Precompiling LaTeX formulas & Markdown formatting...');
	const compiledQuestions = precompileQuestionsMath(similarResult.questions);

	const finalTitle =
		job.title?.trim() ||
		similarResult.title?.trim() ||
		`${sourceTest.title} (Similar Paper)`;

	const finalTotalMarks =
		similarResult.totalMarks ||
		compiledQuestions.reduce((acc, q) => acc + (q.marks || 4), 0);

	const finalDuration = job.isUntimed
		? null
		: typeof similarResult.durationMinutes === 'number'
			? similarResult.durationMinutes
			: (job.durationMinutes ?? sourceTest.durationMinutes ?? 60);

	const chosenSubjectId =
		job.subjectId || sourceTest.subjectId || DEFAULT_SUBJECT_IDS.GENERAL;

	const newId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

	const newTest: TestItem = {
		id: newId,
		title: finalTitle,
		description:
			job.description ||
			`Generated similar paper based on "${sourceTest.title}" (${compiledQuestions.length} questions).`,
		subjectId: chosenSubjectId,
		durationMinutes: finalDuration,
		totalMarks: finalTotalMarks,
		testFileName: `${finalTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
		testFileSizeFormatted: 'AI Synthesized',
		createdAt: new Date().toISOString(),
		status: 'ready',
		questions: compiledQuestions,
		aiProvider: job.aiProvider,
		aiModel: job.aiModel,
		tokenUsage: similarResult.tokenUsage,
		blueprint,
		generatedFromTestId: sourceTest.id,
	};

	options.onProgress(98, 'Persisting synthesized assessment to database...');
	await db.tests.put(newTest);

	options.onProgress(100, 'Assessment Ready!');
	return newTest;
}

/**
 * Coordinates standard document ingestion & digitization job
 */
async function executeDigitizeJob(
	job: GenerationJob,
	options: ExecuteJobOptions
): Promise<TestItem> {
	if (!job.testFileBlob) {
		throw new Error('No test document file provided for digitization.');
	}

	const payload: TestUploadPayload = {
		title: job.autoTitle ? undefined : job.title || undefined,
		autoTitle: job.autoTitle,
		subjectId: job.subjectId,
		durationMinutes: job.durationMinutes,
		autoDuration: job.autoDuration,
		isUntimed: job.isUntimed,
		scale: job.scale,
		aiProvider: job.aiProvider,
		aiModel: job.aiModel,
		questionCount: job.questionCount,
		totalMarks: job.totalMarks,
		description: job.description,
		testFile: {
			name: job.testFileName || 'test.pdf',
			size: job.testFileBlob.size,
			formattedSize: job.testFileSizeFormatted || formatBytes(job.testFileBlob.size),
			rawFile: job.testFileBlob,
		},
		answerKeyFile: job.answerKeyBlob
			? {
					name: job.answerKeyFileName || 'answer_key.pdf',
					size: job.answerKeyBlob.size,
					formattedSize:
						job.answerKeyFileSizeFormatted || formatBytes(job.answerKeyBlob.size),
					rawFile: job.answerKeyBlob,
				}
			: null,
	};

	return await processTestUpload(payload, {
		apiKey: options.apiKey,
		signal: job.abortController?.signal,
		onProgress: (pct, statusText) => {
			options.onProgress(pct, statusText);
		},
	});
}

/**
 * Executes a single generation job through the ingestion & AI pipeline
 */
export async function executeGenerationJob(
	job: GenerationJob,
	options: ExecuteJobOptions
): Promise<void> {
	if (!options.isOnline) {
		options.onPausedOffline();
		return;
	}

	if (!options.apiKey.trim()) {
		options.onFailure(
			`API key for ${job.aiProvider.toUpperCase()} is not configured or unlocked.`
		);
		return;
	}

	try {
		let createdTest: TestItem;

		if (job.jobType === 'similar_paper') {
			createdTest = await executeSimilarPaperJob(job, options);
		} else {
			createdTest = await executeDigitizeJob(job, options);
		}

		options.onSuccess(createdTest);
	} catch (err: unknown) {
		const error = err as Error;

		// 1. Manual user cancellation
		if (error.name === 'AbortError' || job.abortController?.signal.aborted) {
			options.onCancel();
			return;
		}

		// 2. Offline network loss mid-flight
		if (!options.isOnline || error.message.includes('offline') || error.message.includes('network')) {
			options.onPausedOffline();
			return;
		}

		// 3. 429 Rate Limit detection and exponential backoff
		const isRateLimit =
			error.message.includes('429') ||
			error.message.includes('RESOURCE_EXHAUSTED') ||
			error.message.toLowerCase().includes('rate limit') ||
			error.message.toLowerCase().includes('quota exceeded') ||
			error.message.toLowerCase().includes('too many requests');

		if (isRateLimit && job.retryCount < job.maxRetries) {
			const nextRetryCount = job.retryCount + 1;
			const backoffSeconds = Math.min(60, 5 * Math.pow(2, nextRetryCount - 1)); // 5s, 10s, 20s, 40s
			const nextRetryTimestamp = Date.now() + backoffSeconds * 1000;

			options.onRateLimitBackoff(
				backoffSeconds,
				nextRetryTimestamp,
				nextRetryCount,
				job.maxRetries
			);

			let remaining = backoffSeconds;
			const timer = setInterval(() => {
				// Stop timer if user cancelled job while waiting
				if (job.abortController?.signal.aborted || job.status === 'cancelled') {
					clearInterval(timer);
					options.onCancel();
					return;
				}

				remaining -= 1;
				if (remaining > 0 && job.status === 'paused') {
					options.onRateLimitCountdown(remaining);
				} else {
					clearInterval(timer);
					if (job.status === 'paused' && !job.abortController?.signal.aborted) {
						options.onRateLimitRetryReady();
					}
				}
			}, 1000);

			// Listen for instant abort signal during backoff countdown
			job.abortController?.signal.addEventListener(
				'abort',
				() => {
					clearInterval(timer);
					options.onCancel();
				},
				{ once: true }
			);

			return;
		}

		// 4. Unrecoverable / Fatal error
		options.onFailure(error.message || 'Unknown generation error occurred.');
	}
}
