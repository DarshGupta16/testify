/**
 * Generation Queue Store
 *
 * Provides a resilient, non-blocking background job queue with O(1) SvelteMap indexing,
 * sequential and concurrent worker scheduling, Dexie persistence, and reactive state.
 */

import { SvelteMap } from 'svelte/reactivity';
import { db, fireAndForget } from '$lib/services/db';
import {
	buildBatchGenerationJobs,
	buildSimilarPaperJob,
	QueueDispatcher,
	type QueueDispatcherHost,
	recreatePlaceholderTest,
} from '$lib/services/queue';
import { SETTINGS_KEYS } from '$lib/services/settings';
import type { AIProvider } from '$lib/types/apiKeys';
import type {
	BatchGenerationConfig,
	BatchUploadItem,
	GenerationJob,
	QueueMode,
	SimilarPaperJobOptions,
} from '$lib/types/queue';
import type { TestItem } from '$lib/types/test';
import type { AppStore } from './appContext.svelte';

export class GenerationQueueStore implements QueueDispatcherHost {
	app!: AppStore;
	private dispatcher = new QueueDispatcher();

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
	 * Retrieve a job by ID from the in-memory map
	 */
	getJob(id: string): GenerationJob | undefined {
		return this.jobsMap.get(id);
	}

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

		const { jobs: newJobs, placeholderTests } = buildBatchGenerationJobs(items, config);

		for (let i = 0; i < newJobs.length; i++) {
			const job = newJobs[i];
			const placeholderTest = placeholderTests[i];

			this.jobsMap.set(job.id, job);

			// Pre-allocate placeholder in TestStore and FolderStore inverted index
			this.app.tests.addPlaceholderTest(placeholderTest);
			this.app.folders.addTestToFolderIndex(placeholderTest.id, job.folderId ?? null);
		}

		fireAndForget(
			db.bulkSaveTests(placeholderTests),
			`Persisting ${placeholderTests.length} pre-allocated tests to Dexie`
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
	async enqueueSimilarPaperJob(options: SimilarPaperJobOptions): Promise<GenerationJob> {
		const newJob = buildSimilarPaperJob(options, this.app?.selectedScale || 1.25);

		this.jobsMap.set(newJob.id, newJob);
		this.persistJobUpdate(newJob);

		this.pump();
		return newJob;
	}

	/**
	 * Backward compatibility helper for enqueueSimilarPaper
	 */
	async enqueueSimilarPaper(
		sourceTest: TestItem,
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
	 * Core dispatcher loop: Delegates capacity evaluation and dispatching to QueueDispatcher
	 */
	pump(): void {
		this.dispatcher.pump(this);
	}

	/**
	 * Cancel a job by ID (O(1)) - works on active, queued, or paused jobs
	 */
	cancelJob(id: string): void {
		const job = this.jobsMap.get(id);
		this.dispatcher.cancelInFlight(id, job?.abortController);
		if (!job) return;

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
		const job = this.jobsMap.get(id);
		this.dispatcher.cancelInFlight(id, job?.abortController);

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

		// Ensure placeholder test stub in this.app.tests has status reset to 'processing'
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
				const placeholderTest = recreatePlaceholderTest(job);
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
		const job = this.jobsMap.get(id);
		this.dispatcher.cancelInFlight(id, job?.abortController);

		// Delete placeholder TestItem if present and not completed
		if (job?.testId && job.status !== 'completed') {
			this.deletePlaceholderTest(job.testId, job.folderId ?? null);
		}

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
				this.dispatcher.clearInFlight(id);
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
