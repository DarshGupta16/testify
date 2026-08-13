/**
 * Testify - Domain Models & Types
 */

export interface QuestionPreview {
	id: string;
	questionNumber: number;
	type: 'multiple_choice' | 'numerical' | 'subjective';
	text: string;
	options?: string[];
	correctAnswer?: string;
	marks: number;
}

export type TestStatus = 'ready' | 'processing' | 'error';

export interface TestItem {
	id: string;
	title: string;
	description?: string;
	subject: string;
	durationMinutes: number;
	questionCount: number;
	totalMarks: number;
	hasAnswerKey: boolean;
	testFileName: string;
	testFileSizeFormatted: string;
	answerKeyFileName?: string;
	answerKeyFileSizeFormatted?: string;
	createdAt: string; // ISO date string
	status: TestStatus;
	tags: string[];
	questions?: QuestionPreview[];
}

export interface TestUploadPayload {
	title: string;
	subject: string;
	durationMinutes: number;
	questionCount: number;
	totalMarks?: number;
	description?: string;
	testFile: {
		name: string;
		size: number;
		formattedSize: string;
	} | null;
	answerKeyFile: {
		name: string;
		size: number;
		formattedSize: string;
	} | null;
}

export type CategoryFilter =
	| 'All'
	| 'STEM'
	| 'Computer Science'
	| 'Humanities'
	| 'Languages'
	| 'General';

export type SortOption =
	| 'newest'
	| 'oldest'
	| 'questions-desc'
	| 'questions-asc'
	| 'duration-desc'
	| 'title-asc';

export type ThemeMode = 'light' | 'dark';
