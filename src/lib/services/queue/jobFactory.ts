/**
 * Testify - Generation Job Factory
 *
 * Provides pure factory functions to synthesize GenerationJob and placeholder
 * TestItem records for batch document uploads and similar paper generation.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
	BatchGenerationConfig,
	BatchUploadItem,
	GenerationJob,
	SimilarPaperJobOptions,
} from '$lib/types/queue';
import { DEFAULT_SUBJECT_IDS } from '$lib/types/subject';
import type { TestItem } from '$lib/types/test';
import { formatBytes } from '$lib/utils';

export interface BatchJobsResult {
	jobs: GenerationJob[];
	placeholderTests: TestItem[];
}

/**
 * Builds generation jobs and matching placeholder tests for a batch upload.
 */
export function buildBatchGenerationJobs(
	items: BatchUploadItem[],
	config: BatchGenerationConfig
): BatchJobsResult {
	const jobs: GenerationJob[] = [];
	const placeholderTests: TestItem[] = [];
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

		jobs.push(newJob);
		placeholderTests.push(placeholderTest);
	}

	return { jobs, placeholderTests };
}

/**
 * Builds a similar paper generation job.
 */
export function buildSimilarPaperJob(
	options: SimilarPaperJobOptions,
	selectedScale = 1.25
): GenerationJob {
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

	return {
		id: jobId,
		title: jobTitle,
		subjectId: chosenSubjectId,
		folderId: chosenFolderId,
		status: 'queued',
		progress: 0,
		statusText: 'Queued for similar paper generation...',
		aiProvider: chosenProvider,
		aiModel: chosenModel,
		scale: selectedScale,
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
}

/**
 * Recreates a placeholder TestItem for a retried job whose placeholder was purged.
 */
export function recreatePlaceholderTest(job: GenerationJob): TestItem {
	return {
		id: job.testId || uuidv4(),
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
}
