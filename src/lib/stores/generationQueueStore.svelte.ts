/**
 * Generation Queue Store
 *
 * Provides a resilient, non-blocking background job queue with O(1) SvelteMap indexing,
 * Sequential & Uncapped Concurrent worker pools, Dexie persistence, and reactive state.
 */

import { SvelteMap } from 'svelte/reactivity';
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
import type { TestItem } from '$lib/types/test';
import { formatBytes } from '$lib/utils';
import type { AppStore } from './appContext.svelte';

export class GenerationQueueStore {
	private app!: AppStore;

	// In-Flight Execution Guard (guarantees a job is never dispatched more than once)
	private inFlightJobIds = new Set<string>();

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
	readonly incompleteCount = $derived(this.activeJobs.length + this.queuedJobs.length + this.pausedJobs.length);
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
					if (job.status === 'processing' || (job.status === 'paused' && this.app.network.isOnline)) {
						job = {
							...job,
							status: 'queued',
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
	 * Resume paused jobs on internet reconnection
	 */
	handleNetworkRestored(): void {
		const unpaused: GenerationJob[] = [];
		for (const job of this.jobsMap.values()) {
			if (job.status === 'paused') {
				const updated = this.updateJob(job.id, {
					status: 'queued',
					countdownSeconds: undefined,
					statusText: 'Connection restored. Queued for generation...',
				});
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
		const createdAtIso = new Date().toISOString();

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i}`;

			const testFileBlob =
				item.testFile.rawFile instanceof Blob
					? item.testFile.rawFile
					: new Blob([item.testFile.rawFile as unknown as BlobPart], { type: 'application/pdf' });

			let answerKeyBlob: Blob | undefined;
			if (item.answerKeyFile?.rawFile) {
				answerKeyBlob =
					item.answerKeyFile.rawFile instanceof Blob
						? item.answerKeyFile.rawFile
						: new Blob([item.answerKeyFile.rawFile as unknown as BlobPart], { type: 'application/pdf' });
			}

			const jobTitle = item.autoTitle
				? ''
				: item.title.trim() || item.testFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

			const newJob: GenerationJob = {
				id: jobId,
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

			this.jobsMap.set(newJob.id, newJob);
			newJobs.push(newJob);
		}

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
		sourceTest: TestItem;
		subjectId?: string;
		title?: string;
		customInstructions?: string;
		targetQuestionCount?: number;
		questionCount?: number;
		durationMinutes?: number | null;
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
			options.targetQuestionCount ||
			options.questionCount ||
			sourceTest.questions?.length ||
			10;
		const chosenProvider = options.aiProvider || sourceTest.aiProvider || 'google';
		const chosenModel = options.aiModel || sourceTest.aiModel || 'gemini-3.7-flash';
		const chosenSubjectId = options.subjectId || sourceTest.subjectId;

		const newJob: GenerationJob = {
			id: jobId,
			title: jobTitle,
			subjectId: chosenSubjectId,
			status: 'queued',
			progress: 0,
			statusText: 'Queued for similar paper generation...',
			aiProvider: chosenProvider,
			aiModel: chosenModel,
			scale: this.app?.selectedScale || 1.25,
			durationMinutes: options.durationMinutes ?? sourceTest.durationMinutes,
			autoDuration: false,
			isUntimed: options.isUntimed ?? (sourceTest.durationMinutes === null),
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
		sourceTest: TestItem,
		config: {
			questionCount: number;
			durationMinutes: number | null;
			isUntimed: boolean;
			customInstructions?: string;
			aiProvider: AIProvider;
			aiModel: string;
		}
	): Promise<GenerationJob> {
		return this.enqueueSimilarPaperJob({
			sourceTest,
			questionCount: config.questionCount,
			targetQuestionCount: config.questionCount,
			durationMinutes: config.durationMinutes,
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
				this.updateJob(job.id, { progress: pct, statusText }, false);
			},
			onSuccess: (createdTest) => {
				this.inFlightJobIds.delete(job.id);
				this.updateJob(job.id, {
					status: 'completed',
					progress: 100,
					statusText: 'Assessment Ready!',
					completedAt: new Date().toISOString(),
					resultTestId: createdTest.id,
					abortController: undefined,
				});

				// Save test and docAssets to Dexie
				if (createdTest.extractedData) {
					this.app.tests.docAssetsCache.set(createdTest.id, createdTest.extractedData);
				}
				this.app.tests.tests = [createdTest, ...this.app.tests.tests];
				fireAndForget(db.saveTest(createdTest), `Persisting test "${createdTest.title}" to Dexie`);

				this.app.toast.show(`Test "${createdTest.title}" created successfully!`, 'success');
				this.pump();
			},
			onCancel: () => {
				this.inFlightJobIds.delete(job.id);
				this.updateJob(job.id, {
					status: 'cancelled',
					statusText: 'Cancelled by user',
					countdownSeconds: undefined,
					abortController: undefined,
				});
				this.pump();
			},
			onPausedOffline: () => {
				this.inFlightJobIds.delete(job.id);
				this.updateJob(job.id, {
					status: 'paused',
					statusText: 'Internet connection lost. Waiting to reconnect...',
					countdownSeconds: undefined,
					abortController: undefined,
				});
			},
			onRateLimitBackoff: (countdownSeconds, nextRetryTimestamp, retryCount, maxRetries) => {
				this.inFlightJobIds.delete(job.id);
				this.updateJob(job.id, {
					status: 'paused',
					retryCount,
					nextRetryTimestamp,
					countdownSeconds,
					statusText: `Rate limit encountered. Retrying in ${countdownSeconds}s (Attempt ${retryCount}/${maxRetries})...`,
				});
			},
			onRateLimitCountdown: (remainingSeconds) => {
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
				this.updateJob(job.id, {
					status: 'queued',
					countdownSeconds: undefined,
					statusText: 'Retrying generation...',
				});
				this.pump();
			},
			onFailure: (errorMessage) => {
				this.inFlightJobIds.delete(job.id);
				this.updateJob(job.id, {
					status: 'failed',
					error: errorMessage,
					statusText: `Failed: ${errorMessage}`,
					countdownSeconds: undefined,
					abortController: undefined,
				});
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
		const job = this.jobsMap.get(id);
		if (!job) return;

		job.abortController?.abort();
		this.inFlightJobIds.delete(id);
		this.updateJob(id, {
			status: 'cancelled',
			statusText: 'Cancelled by user',
			countdownSeconds: undefined,
			abortController: undefined,
		});
		this.pump();
	}

	/**
	 * Retry a failed or cancelled job by ID (O(1))
	 */
	retryJob(id: string): void {
		this.inFlightJobIds.delete(id);
		this.updateJob(id, {
			status: 'queued',
			progress: 0,
			error: undefined,
			retryCount: 0,
			countdownSeconds: undefined,
			statusText: 'Queued for generation...',
			abortController: undefined,
		});
		this.pump();
	}

	/**
	 * Remove a job completely (O(1))
	 */
	removeJob(id: string): void {
		const job = this.jobsMap.get(id);
		if (job?.abortController) {
			job.abortController.abort();
		}

		this.inFlightJobIds.delete(id);
		this.jobsMap.delete(id);
		fireAndForget(db.deleteGenerationJob(id), `Deleting generation job "${id}" from Dexie`);
		this.pump();
	}

	/**
	 * Clear all finished jobs
	 */
	clearCompleted(): void {
		for (const [id, job] of this.jobsMap.entries()) {
			if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
				this.inFlightJobIds.delete(id);
				this.jobsMap.delete(id);
			}
		}
		fireAndForget(db.clearCompletedGenerationJobs(), 'Clearing finished generation jobs from Dexie');
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
	 * Persist updated job to Dexie asynchronously (O(1))
	 */
	private persistJobUpdate(job: GenerationJob): void {
		const { abortController: _, countdownSeconds: __, ...serializable } = job;
		fireAndForget(
			db.saveGenerationJob(serializable),
			`Persisting generation job "${job.id}" update to Dexie`
		);
	}
}
