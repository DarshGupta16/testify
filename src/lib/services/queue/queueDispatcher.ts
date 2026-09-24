/**
 * Testify - Queue Dispatcher
 *
 * Coordinates execution slots, worker concurrency pools, in-flight locks,
 * run tokens, and event callbacks for background generation jobs.
 */

import { db, fireAndForget } from '$lib/services/db';
import { executeGenerationJob } from '$lib/services/jobExecutor';
import type { AppStore } from '$lib/stores/appContext.svelte';
import type { GenerationJob, QueueMode } from '$lib/types/queue';

export interface QueueDispatcherHost {
	readonly mode: QueueMode;
	readonly concurrency: number;
	readonly isInitialized: boolean;
	readonly app: AppStore;
	readonly activeJobs: GenerationJob[];
	readonly queuedJobs: GenerationJob[];
	getJob(id: string): GenerationJob | undefined;
	updateJob(
		id: string,
		updates: Partial<GenerationJob>,
		persistToDb?: boolean
	): GenerationJob | undefined;
	pump(): void;
}

export class QueueDispatcher {
	private inFlightJobIds = new Set<string>();
	private activeRunTokens = new Map<string, string>();

	isInFlight(jobId: string): boolean {
		return this.inFlightJobIds.has(jobId);
	}

	cancelInFlight(jobId: string, abortController?: AbortController): void {
		this.activeRunTokens.delete(jobId);
		this.inFlightJobIds.delete(jobId);
		if (abortController) {
			abortController.abort();
		}
	}

	clearInFlight(jobId: string): void {
		this.activeRunTokens.delete(jobId);
		this.inFlightJobIds.delete(jobId);
	}

	clearAll(): void {
		this.activeRunTokens.clear();
		this.inFlightJobIds.clear();
	}

	pump(host: QueueDispatcherHost): void {
		if (!host.isInitialized || !host.app?.network?.isOnline) return;

		const maxCapacity = host.mode === 'sequential' ? 1 : Math.max(1, host.concurrency);
		const availableSlots = maxCapacity - host.activeJobs.length;
		if (availableSlots <= 0) return;

		const pendingJobs = host.queuedJobs
			.filter((j) => !this.inFlightJobIds.has(j.id))
			.slice(0, availableSlots);

		for (const job of pendingJobs) {
			this.dispatchJob(job, host);
		}
	}

	private async dispatchJob(job: GenerationJob, host: QueueDispatcherHost): Promise<void> {
		if (this.inFlightJobIds.has(job.id)) return;
		this.inFlightJobIds.add(job.id);

		const runToken = crypto.randomUUID();
		this.activeRunTokens.set(job.id, runToken);

		host.updateJob(job.id, {
			status: 'processing',
			progress: 5,
			statusText: 'Initiating assessment generation...',
			startedAt: new Date().toISOString(),
			abortController: new AbortController(),
		});

		const apiKey = host.app.apiKeys.getKey(job.aiProvider) || '';
		const currentJob = host.getJob(job.id) || job;

		await executeGenerationJob(currentJob, {
			apiKey,
			isOnline: host.app.network.isOnline,
			onProgress: (pct, statusText) => {
				if (this.activeRunTokens.get(job.id) !== runToken) return;
				host.updateJob(job.id, { progress: pct, statusText }, false);
			},
			onBlueprintCached: (testId, blueprint) => {
				if (this.activeRunTokens.get(job.id) !== runToken) return;
				host.app.tests.updateTestBlueprint(testId, blueprint);
			},
			onSuccess: (createdTest) => {
				if (this.activeRunTokens.get(job.id) !== runToken) return;
				this.activeRunTokens.delete(job.id);
				this.inFlightJobIds.delete(job.id);

				const effectiveTestId = job.testId || createdTest.id;
				createdTest.id = effectiveTestId;

				// Validate folderId still exists (fallback to null if deleted)
				let targetFolderId =
					job.folderId !== undefined ? job.folderId : (createdTest.folderId ?? null);
				if (targetFolderId && !host.app.folders.folderMap.has(targetFolderId)) {
					targetFolderId = null;
				}
				createdTest.folderId = targetFolderId;
				createdTest.status = 'ready';

				host.updateJob(job.id, {
					status: 'completed',
					pauseReason: undefined,
					progress: 100,
					statusText: 'Assessment Ready!',
					completedAt: new Date().toISOString(),
					resultTestId: effectiveTestId,
					abortController: undefined,
				});

				// Promote pre-allocated placeholder to ready test and cache doc assets
				host.app.tests.promoteReadyTest(createdTest);

				// Ensure folder index reflects the validated folderId
				host.app.folders.addTestToFolderIndex(effectiveTestId, targetFolderId);

				fireAndForget(db.saveTest(createdTest), `Persisting test "${createdTest.title}" to Dexie`);

				host.app.toast.show(`Test "${createdTest.title}" created successfully!`, 'success');
				host.pump();
			},
			onCancel: () => {
				if (this.activeRunTokens.get(job.id) !== runToken) return;
				this.activeRunTokens.delete(job.id);
				this.inFlightJobIds.delete(job.id);

				host.updateJob(job.id, {
					status: 'cancelled',
					pauseReason: undefined,
					statusText: 'Cancelled by user',
					countdownSeconds: undefined,
					abortController: undefined,
				});
				host.pump();
			},
			onPausedOffline: () => {
				if (this.activeRunTokens.get(job.id) !== runToken) return;
				this.activeRunTokens.delete(job.id);
				this.inFlightJobIds.delete(job.id);

				host.updateJob(job.id, {
					status: 'paused',
					pauseReason: 'offline',
					statusText: 'Internet connection lost. Waiting to reconnect...',
					countdownSeconds: undefined,
					abortController: undefined,
				});
			},
			onRateLimitBackoff: (countdownSeconds, nextRetryTimestamp, retryCount, maxRetries) => {
				if (this.activeRunTokens.get(job.id) !== runToken) return;
				this.inFlightJobIds.delete(job.id);

				host.updateJob(job.id, {
					status: 'paused',
					pauseReason: 'rate_limit',
					retryCount,
					nextRetryTimestamp,
					countdownSeconds,
					statusText: `Rate limit encountered. Retrying in ${countdownSeconds}s (Attempt ${retryCount}/${maxRetries})...`,
				});
			},
			onRateLimitCountdown: (remainingSeconds) => {
				if (this.activeRunTokens.get(job.id) !== runToken) return;
				host.updateJob(
					job.id,
					{
						countdownSeconds: remainingSeconds,
						statusText: `Rate limit encountered. Retrying in ${remainingSeconds}s...`,
					},
					false
				);
			},
			onRateLimitRetryReady: () => {
				if (this.activeRunTokens.get(job.id) !== runToken) return;
				this.activeRunTokens.delete(job.id);

				host.updateJob(job.id, {
					status: 'queued',
					pauseReason: undefined,
					countdownSeconds: undefined,
					statusText: 'Retrying generation...',
				});
				host.pump();
			},
			onFailure: (errorMessage) => {
				if (this.activeRunTokens.get(job.id) !== runToken) return;
				this.activeRunTokens.delete(job.id);
				this.inFlightJobIds.delete(job.id);

				host.updateJob(job.id, {
					status: 'failed',
					pauseReason: undefined,
					error: errorMessage,
					statusText: `Failed: ${errorMessage}`,
					countdownSeconds: undefined,
					abortController: undefined,
				});

				// Update pre-allocated test stub to status: 'error' with error message
				if (job.testId) {
					host.app.tests.markTestError(job.testId, errorMessage);
				}

				host.app.toast.show(
					`Generation failed for "${job.title || job.testFileName}": ${errorMessage}`,
					'error',
					8000
				);
				host.pump();
			},
		});
	}
}
