/**
 * Generation Queue Store
 *
 * Provides a resilient, non-blocking background job queue with O(1) SvelteMap indexing,
 * Sequential & Uncapped Concurrent worker pools, Dexie persistence, and reactive state.
 */

import { SvelteMap } from 'svelte/reactivity';
import { v4 as uuidv4 } from 'uuid';
import { db, fireAndForget } from '$lib/services/db';
import { executeGenerationJob } from '$lib/services/jobExecutor';
import { SETTINGS_KEYS } from '$lib/services/settings';
import type { AIProvider } from '$lib/types/apiKeys';
import type {
	BatchGenerationConfig,
	BatchUploadItem,
	GenerationJob,
	QueueMode,
} from '$lib/types/queue';
import { DEFAULT_SUBJECT_IDS } from '$lib/types/subject';
import type { TestItem } from '$lib/types/test';
import { formatBytes } from '$lib/utils';
import type { AppStore } from './appContext.svelte';

export class GenerationQueueStore {
	private app!: AppStore;

	// In-Flight Execution Guard (guarantees a job is never dispatched more than once)
	private inFlightJobIds = new Set<string>();

	// Execution Run Tokens (prevents stale / aborted executions from mutating retried jobs)
	private activeRunTokens = new Map<string, string>();

	// Primary O(1) Key-Value Store
	readonly jobsMap = new SvelteMap<string, GenerationJob>();

	// Reactive Queue Configuration
	mode = $state<QueueMode>('sequential');
	concurrency = $state<number>(1);
	isDrawerOpen = $state<boolean>(false);
	isInitialized = $state<boolean>(false);

	// Derived List and Queries
	readonly jobs = $derived(Array.from(this.jobsMap.values()));
	readonly activeJobs = $derived(this.jobs.filter((j) => j.status === 'processing'));
	readonly queuedJobs = $derived(this.jobs.filter((j) => j.status === 'queued'));
	readonly pausedJobs = $derived(this.jobs.filter((j) => j.status === 'paused'));
	readonly completedJobs = $derived(this.jobs.filter((j) => j.status === 'completed'));
	readonly failedJobs = $derived(this.jobs.filter((j) => j.status === 'failed'));

	readonly activeCount = $derived(this.activeJobs.length);
	readonly queuedCount = $derived(this.queuedJobs.length);
	readonly incompleteCount = $derived(
		this.activeJobs.length + this.queuedJobs.length + this.pausedJobs.length
	);
	readonly isProcessing = $derived(this.activeJobs.length > 0 || this.queuedJobs.length > 0);

	readonly overallProgress = $derived.by(() => {
		const totalIncomplete = this.incompleteCount;
		if (totalIncomplete === 0) return 0;
		const sumProgress = this.jobs
			.filter((j) => j.status === 'processing' || j.status === 'queued' || j.status === 'paused')
			.reduce((acc, curr) => acc + (curr.progress || 0), 0);
		return Math.round(sumProgress / totalIncomplete);
	});

	/**
	 * Atomically updates a job in the SvelteMap to trigger reactive graph recalculation,
	 * optionally persisting the change to Dexie IndexedDB.
	 */
	updateJob(
		id: string,
		updates: Partial<GenerationJob>,
		persistToDb = true
	): GenerationJob | undefined {
		const current = this.jobsMap.get(id);
		if (!current) return undefined;

		const updated: GenerationJob = { ...current, ...updates };
		this.jobsMap.set(id, updated);

		if (persistToDb) {
			this.persistJobUpdate(updated);
		}

		return updated;
	}

	/**
	 * Initialize queue preferences and restore persisted jobs from IndexedDB
	 */
	async init(app: AppStore): Promise<void> {
		this.app = app;

		try {
			// 1. Load saved preferences
			const savedMode = await db.getSetting<QueueMode>(SETTINGS_KEYS.QUEUE_MODE, 'sequential');
			if (savedMode === 'sequential' || savedMode === 'concurrent') {
				this.mode = savedMode;
			}

			const savedConcurrency = await db.getSetting<number>(SETTINGS_KEYS.QUEUE_CONCURRENCY, 1);
			if (typeof savedConcurrency === 'number' && savedConcurrency >= 1) {
				this.concurrency = savedConcurrency;
			}

			// 2. Restore jobs from Dexie into SvelteMap (preserving FIFO insertion order)
			const savedJobs = await db.getAllGenerationJobs();
			if (savedJobs && savedJobs.length > 0) {
				const modifiedJobs: GenerationJob[] = [];

				for (const raw of savedJobs) {
					let job: GenerationJob = { ...raw };
					// Restore interrupted processing or paused jobs if online
					if (
						job.status === 'processing' ||
						(job.status === 'paused' && this.app.network.isOnline)
					) {
						job = {
							...job,
							status: 'queued',
							pauseReason: undefined,
							statusText: 'Restored from previous session. Queued for generation...',
							progress: 0,
							countdownSeconds: undefined,
						};
						modifiedJobs.push(job);
					}
					this.jobsMap.set(job.id, job);
				}

				if (modifiedJobs.length > 0) {
					fireAndForget(
						db.bulkSaveGenerationJobs(modifiedJobs),
						'Updating restored generation job statuses in Dexie'
					);
				}
			}

			this.isInitialized = true;

			if (typeof window !== 'undefined') {
				window.addEventListener('online', () => this.handleNetworkRestored());
			}

			this.pump();
		} catch (err) {
			console.error('[GenerationQueueStore] Initialization error:', err);
			this.isInitialized = true;
		}
	}

	/**
	 * Resume paused jobs on internet reconnection (only for offline pauses, not rate limits)
	 */
	handleNetworkRestored(): void {
		const unpaused: GenerationJob[] = [];
		for (const job of this.jobsMap.values()) {
			if (job.status === 'paused' && job.pauseReason === 'offline') {
				const updated = this.updateJob(
					job.id,
					{
						status: 'queued',
						pauseReason: undefined,
						countdownSeconds: undefined,
						statusText: 'Connection restored. Queued for generation...',
					},
					false
				);
				if (updated) unpaused.push(updated);
			}
		}

		if (unpaused.length > 0) {
			fireAndForget(
				db.bulkSaveGenerationJobs(unpaused),
				'Updating unpaused jobs in Dexie after network restoration'
			);
		}

		this.pump();
	}

	/**
	 * Enqueue a batch of test documents
	 */
	async enqueueBatch(
		items: BatchUploadItem[],
		config: BatchGenerationConfig
	): Promise<GenerationJob[]> {
		if (items.length === 0) return [];

		this.setMode(config.mode);
		this.setConcurrency(config.concurrency);

		const newJobs: GenerationJob[] = [];
		const newPlaceholderTests: TestItem[] = [];
		const createdAtIso = new Date().toISOString();

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i}`;
			const assignedTestId = item.testId || uuidv4();
			const assignedFolderId =
				item.folderId !== undefined ? item.folderId : (config.folderId ?? null);

			const testFileBlob =
				item.testFile.rawFile instanceof Blob
					? item.testFile.rawFile
					: new Blob([item.testFile.rawFile as unknown as BlobPart], { type: 'application/pdf' });

			let answerKeyBlob: Blob | undefined;
			if (item.answerKeyFile?.rawFile) {
				answerKeyBlob =
					item.answerKeyFile.rawFile instanceof Blob
						? item.answerKeyFile.rawFile
						: new Blob([item.answerKeyFile.rawFile as unknown as BlobPart], {
								type: 'application/pdf',
							});
			}

			const jobTitle = item.autoTitle
				? ''
				: item.title.trim() || item.testFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

			const newJob: GenerationJob = {
				id: jobId,
				testId: assignedTestId,
				resultTestId: assignedTestId,
				folderId: assignedFolderId,
				title: jobTitle,
				subjectId: config.subjectId,
				status: 'queued',
				progress: 0,
				statusText: 'Queued for generation...',
				aiProvider: config.aiProvider,
				aiModel: config.aiModel,
				scale: config.scale,
				durationMinutes: config.durationMinutes,
				autoTitle: item.autoTitle,
				autoDuration: config.autoDuration,
				isUntimed: config.isUntimed,
				testFileBlob,
				testFileName: item.testFile.name,
				testFileSizeFormatted: item.testFile.formattedSize || formatBytes(testFileBlob.size),
				answerKeyBlob,
				answerKeyFileName: item.answerKeyFile?.name,
				answerKeyFileSizeFormatted: item.answerKeyFile?.formattedSize,
				retryCount: 0,
				maxRetries: 3,
				createdAt: createdAtIso,
			};

			const placeholderTest: TestItem = {
				id: assignedTestId,
				title: jobTitle || item.testFile.name.replace(/\.[^/.]+$/, ''),
				subjectId: config.subjectId,
				folderId: assignedFolderId,
				durationMinutes: config.durationMinutes ?? null,
				totalMarks: config.totalMarks || 0,
				testFileName: item.testFile.name,
				testFileSizeFormatted: item.testFile.formattedSize || formatBytes(testFileBlob.size),
				answerKeyFileName: item.answerKeyFile?.name,
				answerKeyFileSizeFormatted: item.answerKeyFile?.formattedSize,
				createdAt: createdAtIso,
				status: 'processing',
				questions: [],
			};

			this.jobsMap.set(newJob.id, newJob);
			newJobs.push(newJob);
			newPlaceholderTests.push(placeholderTest);

			// Pre-allocate placeholder in TestStore and FolderStore inverted index
			this.app.tests.addPlaceholderTest(placeholderTest);
			this.app.folders.addTestToFolderIndex(assignedTestId, assignedFolderId);
		}

		fireAndForget(
			db.bulkSaveTests(newPlaceholderTests),
			`Persisting ${newPlaceholderTests.length} pre-allocated tests to Dexie`
		);

		fireAndForget(
			db.bulkSaveGenerationJobs(newJobs),
			`Persisting ${newJobs.length} new generation jobs to Dexie`
		);

		this.pump();
		return newJobs;
	}

	/**
	 * Enqueue a similar paper generation job
	 */
	async enqueueSimilarPaperJob(options: {
		sourceTest: import('$lib/types/test').TestItem;
		folderId?: string | null;
		subjectId?: string;
		title?: string;
		customInstructions?: string;
		targetQuestionCount?: number;
		questionCount?: number;
		durationMinutes?: number | null;
		autoDuration?: boolean;
		isUntimed?: boolean;
		totalMarks?: number;
		description?: string;
		aiProvider?: AIProvider;
		aiModel?: string;
	}): Promise<GenerationJob> {
		const { sourceTest } = options;
		const jobId = `job_similar_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
		const createdAtIso = new Date().toISOString();
		const jobTitle = options.title?.trim() || `${sourceTest.title} (Similar)`;
		const targetCount =
			options.targetQuestionCount || options.questionCount || sourceTest.questions?.length || 10;
		const chosenProvider = options.aiProvider || sourceTest.aiProvider || 'google';
		const chosenModel = options.aiModel || sourceTest.aiModel || 'gemini-3.7-flash';
		const chosenSubjectId = options.subjectId || sourceTest.subjectId;
		const chosenFolderId =
			options.folderId !== undefined ? options.folderId : (sourceTest.folderId ?? null);

		const newJob: GenerationJob = {
			id: jobId,
			title: jobTitle,
			subjectId: chosenSubjectId,
			folderId: chosenFolderId,
			status: 'queued',
			progress: 0,
			statusText: 'Queued for similar paper generation...',
			aiProvider: chosenProvider,
			aiModel: chosenModel,
			scale: this.app?.selectedScale || 1.25,
			durationMinutes: options.durationMinutes ?? sourceTest.durationMinutes,
			autoDuration: options.autoDuration ?? false,
			isUntimed: options.isUntimed ?? sourceTest.durationMinutes === null,
			questionCount: targetCount,
			totalMarks: options.totalMarks ?? sourceTest.totalMarks,
			description: options.description,
			retryCount: 0,
			maxRetries: 3,
			createdAt: createdAtIso,
			jobType: 'similar_paper',
			sourceTestId: sourceTest.id,
			sourceTestTitle: sourceTest.title,
			customInstructions: options.customInstructions,
			targetQuestionCount: targetCount,
			blueprintCache: sourceTest.blueprint,
			sourceTest,
		};

		this.jobsMap.set(newJob.id, newJob);
		this.persistJobUpdate(newJob);

		this.pump();
		return newJob;
	}

	/**
	 * Backward compatibility helper for enqueueSimilarPaper
	 */
	async enqueueSimilarPaper(
		sourceTest: import('$lib/types/test').TestItem,
		config: {
			folderId?: string | null;
			questionCount: number;
			durationMinutes: number | null;
			autoDuration?: boolean;
			isUntimed: boolean;
			customInstructions?: string;
			aiProvider: AIProvider;
			aiModel: string;
		}
	): Promise<GenerationJob> {
		return this.enqueueSimilarPaperJob({
			sourceTest,
			folderId: config.folderId,
			questionCount: config.questionCount,
			targetQuestionCount: config.questionCount,
			durationMinutes: config.durationMinutes,
			autoDuration: config.autoDuration,
			isUntimed: config.isUntimed,
			customInstructions: config.customInstructions,
			aiProvider: config.aiProvider,
			aiModel: config.aiModel,
		});
	}

	/**
	 * Core dispatcher loop: Inspects capacity and starts next available jobs
	 */
	pump(): void {
		if (!this.isInitialized || !this.app?.network?.isOnline) return;

		const maxCapacity = this.mode === 'sequential' ? 1 : Math.max(1, this.concurrency);
		const availableSlots = maxCapacity - this.activeJobs.length;
		if (availableSlots <= 0) return;

		// Select only queued jobs that are NOT already in-flight
		const pendingJobs = this.queuedJobs
			.filter((j) => !this.inFlightJobIds.has(j.id))
			.slice(0, availableSlots);

		for (const job of pendingJobs) {
			this.dispatchJob(job);
		}
	}

	/**
	 * Dispatches a single job to the stateless executor service
	 */
	private async dispatchJob(job: GenerationJob): Promise<void> {
		if (this.inFlightJobIds.has(job.id)) return;
		this.inFlightJobIds.add(job.id);

		const runToken = crypto.randomUUID();
		this.activeRunTokens.set(job.id, runToken);

		this.updateJob(job.id, {
			status: 'processing',
			progress: 5,
			statusText: 'Initiating assessment generation...',
			startedAt: new Date().toISOString(),
			abortController: new AbortController(),
		});

		const apiKey = this.app.apiKeys.getKey(job.aiProvider) || '';
		const currentJob = this.jobsMap.get(job.id) || job;

		await executeGenerationJob(currentJob, {
			apiKey,
			isOnline: this.app.network.isOnline,
			onProgress: (pct, statusText) => {
				if (this.activeRunTokens.get(job.id) !== runToken) return;
				this.updateJob(job.id, { progress: pct, statusText }, false);
			},
			onBlueprintCached: (testId, blueprint) => {
				if (this.activeRunTokens.get(job.id) !== runToken) return;
				this.app.tests.updateTestBlueprint(testId, blueprint);
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
				if (targetFolderId && !this.app.folders.folderMap.has(targetFolderId)) {
					targetFolderId = null;
				}
				createdTest.folderId = targetFolderId;
				createdTest.status = 'ready';

				this.updateJob(job.id, {
					status: 'completed',
					pauseReason: undefined,
					progress: 100,
					statusText: 'Assessment Ready!',
					completedAt: new Date().toISOString(),
					resultTestId: effectiveTestId,
					abortController: undefined,
				});

				// Promote pre-allocated placeholder to ready test and cache doc assets
				this.app.tests.promoteReadyTest(createdTest);

				// Ensure folder index reflects the validated folderId
				this.app.folders.addTestToFolderIndex(effectiveTestId, targetFolderId);

				fireAndForget(db.saveTest(createdTest), `Persisting test "${createdTest.title}" to Dexie`);

				this.app.toast.show(`Test "${createdTest.title}" created successfully!`, 'success');
				this.pump();
			},
			onCancel: () => {
				if (this.activeRunTokens.get(job.id) !== runToken) return;
				this.activeRunTokens.delete(job.id);
				this.inFlightJobIds.delete(job.id);

				this.updateJob(job.id, {
					status: 'cancelled',
					pauseReason: undefined,
					statusText: 'Cancelled by user',
					countdownSeconds: undefined,
					abortController: undefined,
				});
				this.pump();
			},
			onPausedOffline: () => {
				if (this.activeRunTokens.get(job.id) !== runToken) return;
				this.activeRunTokens.delete(job.id);
				this.inFlightJobIds.delete(job.id);

				this.updateJob(job.id, {
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

				this.updateJob(job.id, {
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
				this.updateJob(
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

				this.updateJob(job.id, {
					status: 'queued',
					pauseReason: undefined,
					countdownSeconds: undefined,
					statusText: 'Retrying generation...',
				});
				this.pump();
			},
			onFailure: (errorMessage) => {
				if (this.activeRunTokens.get(job.id) !== runToken) return;
				this.activeRunTokens.delete(job.id);
				this.inFlightJobIds.delete(job.id);

				this.updateJob(job.id, {
					status: 'failed',
					pauseReason: undefined,
					error: errorMessage,
					statusText: `Failed: ${errorMessage}`,
					countdownSeconds: undefined,
					abortController: undefined,
				});

				// Update pre-allocated test stub to status: 'error' with error message
				if (job.testId) {
					this.app.tests.markTestError(job.testId, errorMessage);
				}

				this.app.toast.show(
					`Generation failed for "${job.title || job.testFileName}": ${errorMessage}`,
					'error',
					8000
				);
				this.pump();
			},
		});
	}

	/**
	 * Cancel a job by ID (O(1)) - works on active, queued, or paused jobs
	 */
	cancelJob(id: string): void {
		this.activeRunTokens.delete(id);
		const job = this.jobsMap.get(id);
		if (!job) return;

		job.abortController?.abort();
		this.inFlightJobIds.delete(id);
		this.updateJob(id, {
			status: 'cancelled',
			pauseReason: undefined,
			statusText: 'Cancelled by user',
			countdownSeconds: undefined,
			abortController: undefined,
		});

		// Delete placeholder TestItem if present and not yet completed
		if (job.testId && job.status !== 'completed') {
			this.deletePlaceholderTest(job.testId, job.folderId ?? null);
		}

		this.pump();
	}

	/**
	 * Retry a failed or cancelled job by ID (O(1))
	 */
	retryJob(id: string): void {
		this.activeRunTokens.delete(id);
		const job = this.jobsMap.get(id);
		if (job?.abortController) {
			job.abortController.abort();
		}
		this.inFlightJobIds.delete(id);
		this.updateJob(id, {
			status: 'queued',
			pauseReason: undefined,
			progress: 0,
			error: undefined,
			retryCount: 0,
			countdownSeconds: undefined,
			statusText: 'Queued for generation...',
			abortController: undefined,
		});

		// Ensure placeholder test stub in this.app.tests has status reset to 'processing' (or recreate placeholder if it was deleted when cancelled)
		if (job?.testId) {
			const current = this.app.tests.tests.find((t) => t.id === job.testId);
			if (current) {
				const updatedTest: TestItem = {
					...current,
					status: 'processing',
					description: job.description || current.description,
				};
				this.app.tests.updateTest(updatedTest);
			} else {
				const placeholderTest: TestItem = {
					id: job.testId,
					title: job.title || job.testFileName?.replace(/\.[^/.]+$/, '') || 'Untitled Assessment',
					subjectId: job.subjectId || DEFAULT_SUBJECT_IDS.GENERAL,
					folderId: job.folderId ?? null,
					durationMinutes: job.durationMinutes ?? null,
					totalMarks: job.totalMarks || 0,
					testFileName: job.testFileName || 'test.pdf',
					testFileSizeFormatted: job.testFileSizeFormatted || '2.4 MB',
					answerKeyFileName: job.answerKeyFileName,
					answerKeyFileSizeFormatted: job.answerKeyFileSizeFormatted,
					createdAt: job.createdAt || new Date().toISOString(),
					status: 'processing',
					questions: [],
				};
				this.app.tests.addPlaceholderTest(placeholderTest);
				this.app.folders.addTestToFolderIndex(job.testId, job.folderId ?? null);
				fireAndForget(
					db.saveTest(placeholderTest),
					`Recreating placeholder test for retried job "${job.id}"`
				);
			}
		}

		this.pump();
	}

	/**
	 * Remove a job completely (O(1))
	 */
	removeJob(id: string): void {
		this.activeRunTokens.delete(id);
		const job = this.jobsMap.get(id);
		if (job?.abortController) {
			job.abortController.abort();
		}

		// Delete placeholder TestItem if present and not completed
		if (job?.testId && job.status !== 'completed') {
			this.deletePlaceholderTest(job.testId, job.folderId ?? null);
		}

		this.inFlightJobIds.delete(id);
		this.jobsMap.delete(id);
		fireAndForget(db.deleteGenerationJob(id), `Deleting generation job "${id}" from Dexie`);
		this.pump();
	}

	private deletePlaceholderTest(testId: string, folderId: string | null): void {
		this.app.tests.removePlaceholderTest(testId);
		this.app.folders.removeTestFromFolderIndex(testId, folderId);
		fireAndForget(db.deleteTest(testId), `Deleting placeholder test "${testId}" from Dexie`);
	}

	/**
	 * Clear all finished jobs
	 */
	clearCompleted(): void {
		for (const [id, job] of this.jobsMap.entries()) {
			if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
				if ((job.status === 'failed' || job.status === 'cancelled') && job.testId) {
					this.deletePlaceholderTest(job.testId, job.folderId ?? null);
				}
				this.activeRunTokens.delete(id);
				this.inFlightJobIds.delete(id);
				this.jobsMap.delete(id);
			}
		}
		fireAndForget(
			db.clearCompletedGenerationJobs(),
			'Clearing finished generation jobs from Dexie'
		);
	}

	/**
	 * Set queue mode and persist
	 */
	setMode(mode: QueueMode): void {
		if (this.mode === mode) return;
		this.mode = mode;
		fireAndForget(db.setSetting(SETTINGS_KEYS.QUEUE_MODE, mode), `Persisting queue mode "${mode}"`);
		this.pump();
	}

	/**
	 * Set concurrency count and persist
	 */
	setConcurrency(count: number): void {
		const sanitized = Math.max(1, Math.floor(count) || 1);
		if (this.concurrency === sanitized) return;
		this.concurrency = sanitized;
		fireAndForget(
			db.setSetting(SETTINGS_KEYS.QUEUE_CONCURRENCY, sanitized),
			`Persisting queue concurrency "${sanitized}"`
		);
		this.pump();
	}

	/**
	 * Toggle drawer visibility
	 */
	toggleDrawer(open?: boolean): void {
		this.isDrawerOpen = typeof open === 'boolean' ? open : !this.isDrawerOpen;
	}

	/**
	 * Find active, queued, or completed generation job associated with a test ID
	 */
	getJobByTestId(testId: string): GenerationJob | undefined {
		for (const job of this.jobsMap.values()) {
			if (job.testId === testId || job.resultTestId === testId || job.id === testId) {
				return job;
			}
		}
		return undefined;
	}

	/**
	 * Persist updated job to Dexie asynchronously (O(1))
	 * Strips runtime-only properties and sourceTest to prevent multi-megabyte Dexie bloat
	 */
	private persistJobUpdate(job: GenerationJob): void {
		const { abortController: _, countdownSeconds: __, sourceTest: ___, ...serializable } = job;
		fireAndForget(
			db.saveGenerationJob(serializable),
			`Persisting generation job "${job.id}" update to Dexie`
		);
	}
}
