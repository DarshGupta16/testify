/// <reference types="bun-types" />
import { describe, expect, it, mock } from 'bun:test';
import {
	buildBatchGenerationJobs,
	buildSimilarPaperJob,
	QueueDispatcher,
	type QueueDispatcherHost,
	recreatePlaceholderTest,
} from '../src/lib/services/queue';
import type { BatchGenerationConfig, BatchUploadItem, GenerationJob } from '../src/lib/types/queue';
import type { TestItem } from '../src/lib/types/test';

describe('Generation Queue Architecture & Modular Decomposition', () => {
	describe('1. jobFactory: buildBatchGenerationJobs', () => {
		const mockFile = new Blob(['mock-pdf-content'], { type: 'application/pdf' });

		const sampleConfig: BatchGenerationConfig = {
			subjectId: 'sub-science',
			aiProvider: 'google',
			aiModel: 'gemini-3.7-flash',
			scale: 1.5,
			mode: 'sequential',
			concurrency: 1,
			folderId: 'folder-123',
			durationMinutes: 45,
			autoDuration: false,
			isUntimed: false,
		};

		it('builds matching GenerationJob and placeholder TestItem records', () => {
			const items: BatchUploadItem[] = [
				{
					id: 'upload-1',
					title: 'Physics Midterm 2026',
					autoTitle: false,
					folderId: 'folder-123',
					testFile: {
						name: 'physics_midterm.pdf',
						size: 1024,
						formattedSize: '1.0 KB',
						rawFile: mockFile,
					},
					answerKeyFile: null,
				},
				{
					id: 'upload-2',
					title: '',
					autoTitle: true,
					folderId: null,
					testFile: {
						name: 'chemistry_quiz.pdf',
						size: 2048,
						formattedSize: '2.0 KB',
						rawFile: mockFile,
					},
					answerKeyFile: null,
				},
			];

			const result = buildBatchGenerationJobs(items, sampleConfig);

			expect(result.jobs.length).toBe(2);
			expect(result.placeholderTests.length).toBe(2);

			const job1 = result.jobs[0];
			const test1 = result.placeholderTests[0];

			expect(job1.title).toBe('Physics Midterm 2026');
			expect(job1.folderId).toBe('folder-123');
			expect(job1.status).toBe('queued');
			expect(job1.testId).toBe(test1.id);
			expect(test1.status).toBe('processing');
			expect(test1.title).toBe('Physics Midterm 2026');
			expect(test1.durationMinutes).toBe(45);

			const job2 = result.jobs[1];
			const test2 = result.placeholderTests[1];

			expect(job2.autoTitle).toBe(true);
			expect(job2.title).toBe('');
			expect(test2.title).toBe('chemistry_quiz');
			expect(test2.folderId).toBe(null);
		});
	});

	describe('2. jobFactory: buildSimilarPaperJob', () => {
		const sourceTest: TestItem = {
			id: 'test-original-1',
			title: 'Original Biology Exam',
			subjectId: 'bio-101',
			folderId: 'folder-bio',
			durationMinutes: 60,
			totalMarks: 100,
			createdAt: new Date().toISOString(),
			status: 'ready',
			testFileName: 'biology.pdf',
			testFileSizeFormatted: '1.5 MB',
			questions: [
				{
					id: 'q1',
					questionNumber: 1,
					type: 'multiple_choice',
					text: 'Cell question',
					marks: 5,
					options: [],
					correctAnswer: '',
				},
			],
			aiProvider: 'anthropic',
			aiModel: 'claude-3-5-sonnet',
		};

		it('constructs similar paper job inheriting source test metadata', () => {
			const job = buildSimilarPaperJob(
				{
					sourceTest,
					targetQuestionCount: 15,
					customInstructions: 'Make it more challenging',
				},
				1.25
			);

			expect(job.jobType).toBe('similar_paper');
			expect(job.title).toBe('Original Biology Exam (Similar)');
			expect(job.sourceTestId).toBe('test-original-1');
			expect(job.folderId).toBe('folder-bio');
			expect(job.subjectId).toBe('bio-101');
			expect(job.aiProvider).toBe('anthropic');
			expect(job.targetQuestionCount).toBe(15);
			expect(job.customInstructions).toBe('Make it more challenging');
		});
	});

	describe('3. jobFactory: recreatePlaceholderTest', () => {
		it('reconstructs placeholder test from job for retried operations', () => {
			const job: GenerationJob = {
				id: 'job-retry-1',
				testId: 'test-stub-1',
				title: 'Retried Exam',
				subjectId: 'sub-general',
				folderId: 'folder-abc',
				status: 'queued',
				progress: 0,
				statusText: 'Queued',
				aiProvider: 'google',
				aiModel: 'gemini-3.7-flash',
				scale: 1,
				retryCount: 1,
				maxRetries: 3,
				createdAt: new Date().toISOString(),
				testFileName: 'exam.pdf',
				durationMinutes: 90,
				totalMarks: 75,
			};

			const stub = recreatePlaceholderTest(job);

			expect(stub.id).toBe('test-stub-1');
			expect(stub.title).toBe('Retried Exam');
			expect(stub.status).toBe('processing');
			expect(stub.durationMinutes).toBe(90);
			expect(stub.totalMarks).toBe(75);
			expect(stub.folderId).toBe('folder-abc');
		});
	});

	describe('4. QueueDispatcher capacity & lock management', () => {
		it('respects sequential capacity and avoids duplicate in-flight dispatching', () => {
			const dispatcher = new QueueDispatcher();

			const queuedJob1: GenerationJob = {
				id: 'job-1',
				testId: 'test-1',
				title: 'Job 1',
				subjectId: 'sub-1',
				status: 'queued',
				progress: 0,
				statusText: 'Queued',
				aiProvider: 'google',
				aiModel: 'gemini-3.7-flash',
				scale: 1,
				retryCount: 0,
				maxRetries: 3,
				createdAt: new Date().toISOString(),
			};

			const queuedJob2: GenerationJob = {
				id: 'job-2',
				testId: 'test-2',
				title: 'Job 2',
				subjectId: 'sub-1',
				status: 'queued',
				progress: 0,
				statusText: 'Queued',
				aiProvider: 'google',
				aiModel: 'gemini-3.7-flash',
				scale: 1,
				retryCount: 0,
				maxRetries: 3,
				createdAt: new Date().toISOString(),
			};

			const mockHost: QueueDispatcherHost = {
				mode: 'sequential',
				concurrency: 1,
				isInitialized: true,
				app: {
					network: { isOnline: true },
					apiKeys: { getKey: () => 'mock-api-key' },
					tests: { promoteReadyTest: mock(() => {}), markTestError: mock(() => {}) },
					folders: { folderMap: new Map(), addTestToFolderIndex: mock(() => {}) },
					toast: { show: mock(() => {}) },
				} as unknown as QueueDispatcherHost['app'],
				activeJobs: [],
				queuedJobs: [queuedJob1, queuedJob2],
				getJob: (id) => (id === 'job-1' ? queuedJob1 : queuedJob2),
				updateJob: mock((id, updates) => {
					if (id === 'job-1') Object.assign(queuedJob1, updates);
					return queuedJob1;
				}),
				pump: mock(() => {}),
			};

			expect(dispatcher.isInFlight('job-1')).toBe(false);

			dispatcher.pump(mockHost);

			// In sequential mode, only 1 job should be dispatched
			expect(dispatcher.isInFlight('job-1')).toBe(true);
			expect(dispatcher.isInFlight('job-2')).toBe(false);

			// Cleanup
			dispatcher.cancelInFlight('job-1');
			expect(dispatcher.isInFlight('job-1')).toBe(false);
		});
	});
});
