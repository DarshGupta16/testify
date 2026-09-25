/**
 * Generation Job Execution Service
 *
 * Stateless execution engine for background paper generation jobs.
 * Handles payload synthesis, AbortSignal forwarding, processTestUpload dispatch,
 * delegation to similar paper generator, automated 429 rate limit exponential backoff countdowns,
 * and network disconnection handling.
 */

import { processTestUpload } from '$lib/services/testUploader';
import type { PaperBlueprint } from '$lib/types/blueprint';
import type { GenerationJob } from '$lib/types/queue';
import type { TestItem, TestUploadPayload } from '$lib/types/test';
import { formatBytes } from '$lib/utils';
import { generateSimilarPaperTest } from './similarPaperGenerator';

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
	onBlueprintCached?: (testId: string, blueprint: PaperBlueprint) => void;
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
		id: job.testId,
		title: job.autoTitle ? undefined : job.title || undefined,
		autoTitle: job.autoTitle,
		subjectId: job.subjectId,
		folderId: job.folderId ?? null,
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
					formattedSize: job.answerKeyFileSizeFormatted || formatBytes(job.answerKeyBlob.size),
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
		options.onFailure(`API key for ${job.aiProvider.toUpperCase()} is not configured or unlocked.`);
		return;
	}

	try {
		let createdTest: TestItem;

		if (job.jobType === 'similar_paper') createdTest = await generateSimilarPaperTest(job, options);
		else createdTest = await executeDigitizeJob(job, options);

		options.onSuccess(createdTest);
	} catch (err: unknown) {
		const error = err as Error;

		// 1. Manual user cancellation
		if (error.name === 'AbortError' || job.abortController?.signal.aborted) {
			options.onCancel();
			return;
		}

		// 2. Offline network loss mid-flight
		if (
			!options.isOnline ||
			error.message.includes('offline') ||
			error.message.includes('network')
		) {
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
			const jitter = Math.random() * 1.5;
			const backoffSeconds = Math.min(60, Math.round(5 * 2 ** (nextRetryCount - 1) + jitter));
			const nextRetryTimestamp = Date.now() + backoffSeconds * 1000;

			options.onRateLimitBackoff(
				backoffSeconds,
				nextRetryTimestamp,
				nextRetryCount,
				job.maxRetries
			);

			let remaining = backoffSeconds;
			let isCountdownActive = true;
			let timer: ReturnType<typeof setInterval> | undefined;

			const onAbort = () => cleanup();

			const cleanup = (cancel = true) => {
				if (!isCountdownActive) return;
				isCountdownActive = false;
				if (timer) clearInterval(timer);
				job.abortController?.signal.removeEventListener('abort', onAbort);
				if (cancel) options.onCancel();
			};

			timer = setInterval(() => {
				if (job.abortController?.signal.aborted) {
					cleanup();
					return;
				}

				remaining -= 1;
				if (remaining > 0) options.onRateLimitCountdown(remaining);
				else {
					cleanup(false);
					options.onRateLimitRetryReady();
				}
			}, 1000);

			// Listen for instant abort signal during backoff countdown
			if (job.abortController?.signal.aborted) cleanup();
			else job.abortController?.signal.addEventListener('abort', onAbort);

			return;
		}

		// 4. Unrecoverable / Fatal error
		options.onFailure(error.message || 'Unknown generation error occurred.');
	}
}
