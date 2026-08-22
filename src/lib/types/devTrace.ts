/**
 * Testify - Dev-Only AI Pipeline Trace & Execution Diagnostics Domain Types
 */

import type { AIProvider } from '$lib/types/apiKeys';
import type { ExtractedEmbeddedImage } from '$lib/types/pdf';
import type { QuestionPreview, TokenUsageStats } from '$lib/types/test';

export interface DiagramResolutionDiagnostic {
	questionNumber: number;
	rawId: string | null | undefined;
	resolvedId?: string;
	resolvedUrl?: string;
	matchedTier: string;
	questionPage?: number;
	mentionsFigure: boolean;
	questionTextSnippet: string;
}

export interface ExtractionStageTrace {
	durationMs: number;
	scale: number;
	fileName: string;
	fileSizeBytes: number;
	totalPages: number;
	totalDiagrams: number;
	pages: Array<{
		pageNumber: number;
		width: number;
		height: number;
		rasterSizeBytes: number;
		diagramCount: number;
	}>;
	diagrams: ExtractedEmbeddedImage[];
}

export interface PromptPayloadStageTrace {
	systemPrompt: string;
	userPrompt: string;
	pageAssetsCount: number;
	diagramAssetsCount: number;
	diagramCatalog: Array<{ id: string; pageNumber: number }>;
}

export interface AiResponseStageTrace {
	durationMs: number;
	rawResponseText: string;
	tokenUsage?: TokenUsageStats;
}

export interface ParserStageTrace {
	cleanedJsonText: string;
	sanitizedJsonText: string;
	parsedSchema: unknown;
}

export interface NormalizationStageTrace {
	questionsCount: number;
	diagramResolutionLogs: DiagramResolutionDiagnostic[];
	finalQuestions: QuestionPreview[];
}

export interface DevPipelineTrace {
	id: string;
	testId: string;
	testTitle: string;
	createdAt: string; // ISO date string
	provider: AIProvider;
	model: string;
	totalDurationMs: number;
	stages: {
		extraction: ExtractionStageTrace;
		promptPayload: PromptPayloadStageTrace;
		aiResponse: AiResponseStageTrace;
		parser: ParserStageTrace;
		normalization: NormalizationStageTrace;
	};
}
