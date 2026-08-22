/**
 * Testify - AI Testification Domain Types and Interfaces
 */

import type { AIProvider } from '$lib/types/apiKeys';
import type { NormalizationStageTrace, ParserStageTrace } from '$lib/types/devTrace';
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

export interface RawAIOption {
	id: string; // e.g. "opt_a1b2"
	text: string; // Purely option text without "A)" or "B." prefix
}

export interface RawAIQuestion {
	questionNumber: number;
	type:
		| 'single_choice'
		| 'multi_choice'
		| 'numerical'
		| 'multiple_choice'
		| 'multiple_choice_multi';
	text: string;
	options?: Array<RawAIOption | string>; // Array of option objects with random ID, or fallback string
	correctAnswer?: string | string[]; // option ID or array of IDs, or calculated value if numerical
	correctAnswers?: string[]; // array of option IDs for multi-correct questions
	hint?: string;
	explanation?: string;
	marks?: number;
	negativeMarks?: number;
	associatedDiagramId?: string | null;
	pageNumber?: number;
}

export interface RawAIResponseSchema {
	title?: string;
	instructions?: string;
	totalMarks?: number;
	estimatedDurationMinutes?: number;
	questions: RawAIQuestion[];
}

export interface AIGenerationResult {
	provider: AIProvider;
	model: string;
	title?: string;
	instructions?: string;
	durationMinutes?: number | null;
	totalMarks?: number;
	questions: QuestionPreview[];
	rawResponse?: string;
	tokenUsage?: TokenUsageStats;
	diagnostics?: {
		durationMs?: number;
		parser?: ParserStageTrace;
		normalization?: NormalizationStageTrace;
	};
}

export interface AIProviderAdapter {
	readonly id: AIProvider;
	generateQuestions(payload: AIGenerationPayload): Promise<AIGenerationResult>;
}
