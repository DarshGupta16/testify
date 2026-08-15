/**
 * Testify - AI Testification Domain Types and Interfaces
 */

import type { AIProvider } from '$lib/types/apiKeys';
import type { QuestionPreview, TokenUsageStats } from '$lib/types/test';

export interface AIDiagramAsset {
	id: string; // e.g. "diag_p1_0"
	pageNumber: number;
	mimeType: string;
	dataUrl: string; // base64 data URL
}

export interface AIPageAsset {
	pageNumber: number;
	mimeType: string;
	dataUrl: string; // base64 data URL
}

export interface AIGenerationMetadataHints {
	titleHint?: string;
	subjectHint?: string;
	questionCountHint?: number;
	autoTitle?: boolean;
	autoDuration?: boolean;
	isUntimed?: boolean;
	defaultDurationMinutes?: number | null;
	defaultMarksPerQuestion?: number;
}

export interface AIGenerationPayload {
	apiKey: string;
	model: string;
	pages: AIPageAsset[];
	diagrams?: AIDiagramAsset[];
	answerKeyPages?: AIPageAsset[];
	metadata?: AIGenerationMetadataHints;
	onProgress?: (statusText: string, progressPercent?: number) => void;
}

export interface RawAIQuestion {
	questionNumber: number;
	type: 'multiple_choice' | 'numerical';
	text: string;
	options?: string[]; // Expected for multiple_choice, e.g. ["A) ...", "B) ..."]
	correctAnswer?: string;
	explanation?: string;
	marks?: number;
	negativeMarks?: number;
	associatedDiagramId?: string | null;
	pageNumber?: number;
}

export interface RawAIResponseSchema {
	title?: string;
	subject?: string;
	instructions?: string;
	totalMarks?: number;
	estimatedDurationMinutes?: number;
	questions: RawAIQuestion[];
}

export interface AIGenerationResult {
	provider: AIProvider;
	model: string;
	title?: string;
	subject?: string;
	instructions?: string;
	durationMinutes?: number | null;
	totalMarks?: number;
	questions: QuestionPreview[];
	rawResponse?: string;
	tokenUsage?: TokenUsageStats;
}

export interface AIProviderAdapter {
	id: AIProvider;
	generateQuestions(payload: AIGenerationPayload): Promise<AIGenerationResult>;
}
