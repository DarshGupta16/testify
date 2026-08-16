import type { AIProvider } from '$lib/types/apiKeys';
import type { PdfExtractionResult } from '$lib/types/pdf';

export type QuestionType =
	| 'single_choice'
	| 'multi_choice'
	| 'numerical'
	| 'multiple_choice'
	| 'multiple_choice_multi';

export interface QuestionOption {
	id: string; // e.g. "opt_a1b2"
	text: string; // option text
}

export interface QuestionPreview {
	id: string;
	questionNumber: number;
	type: QuestionType;
	text: string;
	options?: QuestionOption[];
	correctAnswer?: string; // option ID if single_choice, or calculated string if numerical
	correctAnswers?: string[]; // array of option IDs if multi_choice
	hint?: string; // Directional/conceptual hint for practice mode
	explanation?: string;
	marks: number;
	negativeMarks?: number;
	associatedDiagramId?: string;
	associatedDiagramUrl?: string;
	pageNumber?: number;
}

export type TestMode = 'practice' | 'exam';

export type AttemptStatus = 'in_progress' | 'completed' | 'abandoned';

export interface UserQuestionResponse {
	questionId: string;
	selectedOptionId?: string; // for single multiple_choice
	selectedOptionIds?: string[]; // for multiple_choice_multi
	numericalAnswer?: string; // for numerical
	isMarkedForReview?: boolean;
	visited?: boolean;
	timeSpentSeconds?: number;
	isCorrect?: boolean;
	isPartiallyCorrect?: boolean;
	marksAwarded?: number;
}

export interface TestAttempt {
	id: string;
	testId: string;
	testTitle: string;
	startedAt: string; // ISO date string
	completedAt?: string; // ISO date string
	durationSecondsTaken: number;
	mode: TestMode;
	status: AttemptStatus;
	responses: Record<string, UserQuestionResponse>; // Keyed by questionId
	score: number;
	maxPossibleScore: number;
	accuracyPercentage: number;
	totalQuestions: number;
	answeredCount: number;
	correctCount: number;
	incorrectCount: number;
	unattemptedCount: number;
	reviewCount: number;
}

export type TestStatus = 'ready' | 'processing' | 'error';

export interface TokenUsageStats {
	promptTokens?: number;
	completionTokens?: number;
	totalTokens?: number;
}

export interface TestItem {
	id: string;
	title: string;
	description?: string;
	subjectId: string;
	durationMinutes: number | null; // null or 0 indicates untimed
	questionCount: number;
	totalMarks: number;
	testFileName: string;
	testFileSizeFormatted: string;
	answerKeyFileName?: string;
	answerKeyFileSizeFormatted?: string;
	createdAt: string; // ISO date string
	status: TestStatus;
	tags: string[];
	questions?: QuestionPreview[];
	// Extracted PDF assets and metrics
	extractedData?: PdfExtractionResult;
	extractedPagesCount?: number;
	extractedDiagramsCount?: number;
	renderScale?: number;
	aiProvider?: AIProvider;
	aiModel?: string;
	tokenUsage?: TokenUsageStats;
}

export interface TestUploadPayload {
	title?: string;
	autoTitle?: boolean;
	subjectId?: string;
	durationMinutes?: number | null;
	autoDuration?: boolean;
	isUntimed?: boolean;
	questionCount?: number;
	totalMarks?: number;
	description?: string;
	scale?: number;
	aiProvider?: AIProvider;
	aiModel?: string;
	testFile: {
		name: string;
		size: number;
		formattedSize: string;
		rawFile?: File | Blob | Uint8Array;
	} | null;
	answerKeyFile: {
		name: string;
		size: number;
		formattedSize: string;
		rawFile?: File | Blob | Uint8Array;
	} | null;
}

export type CategoryFilter = string;

export type SortOption =
	| 'newest'
	| 'oldest'
	| 'questions-desc'
	| 'questions-asc'
	| 'duration-desc'
	| 'title-asc';

export type ThemeMode = 'light' | 'dark';
