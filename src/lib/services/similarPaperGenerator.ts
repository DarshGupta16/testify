/**
 * Similar Paper Generator Service
 *
 * Encapsulates biphasic generation logic for similar paper jobs:
 * Phase 1 (0% - 45%): Extract blueprint or reuse cached blueprint.
 * Phase 2 (45% - 90%): Generate new questions from blueprint.
 * Post-processing (90% - 100%): KaTeX math precompilation & TestItem synthesis.
 */

import { aiService } from '$lib/services/ai';
import { db, fireAndForget } from '$lib/services/db';
import { precompileQuestionsMath } from '$lib/services/mathHtmlCompiler';
import type { PaperBlueprint } from '$lib/types/blueprint';
import type { GenerationJob } from '$lib/types/queue';
import { DEFAULT_SUBJECT_IDS } from '$lib/types/subject';
import type { TestItem } from '$lib/types/test';
import type { ExecuteJobOptions } from './jobExecutor';

/**
 * Coordinates biphasic generation for a similar paper job.
 * Note: Database persistence is handled by the caller / queue store onSuccess handler
 * to prevent duplicate writes and race conditions.
 */
export async function generateSimilarPaperTest(
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
		options.onProgress(
			5,
			'Phase 1/2: Analyzing source paper patterns & reverse-engineering blueprint...'
		);

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

		// Notify caller for reactive in-memory test store caching
		options.onBlueprintCached?.(sourceTest.id, blueprint);
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
		isUntimed: job.isUntimed ?? sourceTest.durationMinutes === null,
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
		job.title?.trim() || similarResult.title?.trim() || `${sourceTest.title} (Similar Paper)`;

	const finalTotalMarks =
		similarResult.totalMarks || compiledQuestions.reduce((acc, q) => acc + (q.marks || 4), 0);

	const finalDuration = job.isUntimed
		? null
		: typeof similarResult.durationMinutes === 'number'
			? similarResult.durationMinutes
			: (job.durationMinutes ?? sourceTest.durationMinutes ?? 60);

	const chosenSubjectId = job.subjectId || sourceTest.subjectId || DEFAULT_SUBJECT_IDS.GENERAL;

	const newId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

	const newTest: TestItem = {
		id: newId,
		title: finalTitle,
		description:
			job.description ||
			`Generated similar paper based on "${sourceTest.title}" (${compiledQuestions.length} questions).`,
		subjectId: chosenSubjectId,
		folderId: job.folderId !== undefined ? job.folderId : (sourceTest.folderId ?? null),
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

	options.onProgress(100, 'Assessment Ready!');
	return newTest;
}
