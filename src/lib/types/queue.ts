/**
 * Testify - Generation Queue Types & Interfaces
 */

import type { AIProvider } from './apiKeys';
import type { PaperBlueprint } from './blueprint';
import type { BaseAssessmentConfig, TestItem } from './test';

export type JobStatus =
	| 'queued'
	| 'processing'
	| 'paused'
	| 'completed'
	| 'failed'
	| 'cancelled';

export type QueueMode = 'sequential' | 'concurrent';

export type GenerationJobType = 'digitize' | 'similar_paper' | 'document';

/**
 * Persisted Generation Job record stored in Dexie IndexedDB
 */
export interface StoredGenerationJob extends BaseAssessmentConfig {
	id: string;
	title: string;
	subjectId: string;
	status: JobStatus;
	progress: number; // 0 to 100
	statusText: string;

	// Job classification
	jobType?: 'digitize' | 'similar_paper' | 'document';

	// Overridden required AI & Scale configurations for active jobs
	aiProvider: AIProvider;
	aiModel: string;
	scale: number;

	// Binary Document Files (Blobs stored natively in IndexedDB)
	testFileBlob?: Blob;
	testFileName?: string;
	testFileSizeFormatted?: string;
	answerKeyBlob?: Blob;
	answerKeyFileName?: string;
	answerKeyFileSizeFormatted?: string;

	// Similar Paper Generation extensions
	sourceTestId?: string;
	sourceTestTitle?: string;
	customInstructions?: string;
	targetQuestionCount?: number;
	blueprintCache?: PaperBlueprint;

	// Resilience, Rate-Limiting & Retries
	retryCount: number;
	maxRetries: number;
	nextRetryTimestamp?: number;
	error?: string;

	// Timestamps & References
	createdAt: string;
	startedAt?: string;
	completedAt?: string;
	resultTestId?: string;
}

/**
 * In-memory Generation Job with active runtime state and AbortController
 */
export interface GenerationJob extends StoredGenerationJob {
	abortController?: AbortController;
	countdownSeconds?: number;
	sourceTest?: TestItem;
}

/**
 * Payload to create a standard document digitization job
 */
export interface CreateDigitizeJobPayload extends BaseAssessmentConfig {
	jobType?: 'digitize' | 'document';
	title?: string;
	subjectId: string;
	aiProvider: AIProvider;
	aiModel: string;
	scale?: number;
	testFileBlob: Blob;
	testFileName: string;
	testFileSizeFormatted?: string;
	answerKeyBlob?: Blob;
	answerKeyFileName?: string;
	answerKeyFileSizeFormatted?: string;
}

/**
 * Payload to create a similar paper generation job
 */
export interface CreateSimilarPaperJobPayload extends BaseAssessmentConfig {
	jobType: 'similar_paper';
	title?: string;
	subjectId?: string;
	aiProvider: AIProvider;
	aiModel: string;
	scale?: number;
	sourceTestId: string;
	sourceTestTitle?: string;
	customInstructions?: string;
	targetQuestionCount?: number;
	blueprintCache?: PaperBlueprint;
}

export type CreateJobPayload = CreateDigitizeJobPayload | CreateSimilarPaperJobPayload;

/**
 * Batch upload item for paired question paper and optional answer key
 */
export interface BatchUploadItem {
	id: string;
	title: string;
	autoTitle: boolean;
	testFile: {
		name: string;
		size: number;
		formattedSize: string;
		rawFile: File | Blob;
	};
	answerKeyFile?: {
		name: string;
		size: number;
		formattedSize: string;
		rawFile?: File | Blob;
	} | null;
}

/**
 * Batch generation configuration applied across multiple documents
 */
export interface BatchGenerationConfig extends BaseAssessmentConfig {
	subjectId: string;
	aiProvider: AIProvider;
	aiModel: string;
	scale: number;
	mode: QueueMode;
	concurrency: number;
}
