/**
 * Generation Job Execution Service
 *
 * Stateless execution engine for background paper generation jobs.
 * Handles payload synthesis, AbortSignal forwarding, processTestUpload dispatch,
 * automated 429 rate limit exponential backoff countdowns, and network disconnection handling.
 */

import { processTestUpload } from '$lib/services/testUploader';
import type { GenerationJob } from '$lib/types/queue';
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

	// Prepare upload payload from job state and binary Blobs
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
			name: job.testFileName,
			size: job.testFileBlob.size,
			formattedSize: job.testFileSizeFormatted,
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

	try {
		const createdTest = await processTestUpload(payload, {
			apiKey: options.apiKey,
			signal: job.abortController?.signal,
			onProgress: (pct, statusText) => {
				options.onProgress(pct, statusText);
			},
		});

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
