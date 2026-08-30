/**
 * Testify - AI Testification Unified Engine Service
 */

import type { PdfExtractionResult } from '$lib/services/pdf';
import type { AIProvider } from '$lib/types/apiKeys';
import type { PaperBlueprint } from '$lib/types/blueprint';
import type { QuestionPreview, TestItem } from '$lib/types/test';

import {
	generateAnthropicPaperBlueprint,
	generateAnthropicQuestions,
	generateAnthropicSimilarPaper,
} from './providers/anthropic';
import {
	generateGooglePaperBlueprint,
	generateGoogleQuestions,
	generateGoogleSimilarPaper,
} from './providers/google';
import {
	generateGroqPaperBlueprint,
	generateGroqQuestions,
	generateGroqSimilarPaper,
} from './providers/groq';
import {
	generateOpenAIPaperBlueprint,
	generateOpenAIQuestions,
	generateOpenAISimilarPaper,
} from './providers/openai';
import type {
	AIDiagramAsset,
	AIGenerationMetadataHints,
	AIGenerationPayload,
	AIGenerationResult,
	AIPageAsset,
	PaperBlueprintExecutionRequest,
	PaperBlueprintPayload,
	PaperBlueprintResult,
	RawAIQuestion,
	SimilarPaperExecutionRequest,
	SimilarPaperGenerationPayload,
	SimilarPaperGenerationResult,
} from './types';

export interface TestifyExecutionRequest {
	provider: AIProvider;
	apiKey: string;
	model: string;
	extractionResult: PdfExtractionResult;
	answerKeyExtractionResult?: PdfExtractionResult | null;
	metadata?: AIGenerationMetadataHints;
	onProgress?: (statusText: string, progressPercent?: number) => void;
}

export interface GeneratePaperBlueprintParams {
	provider: AIProvider;
	apiKey: string;
	model: string;
	sourceTest?: TestItem;
	questions?: QuestionPreview[] | RawAIQuestion[];
	title?: string;
	instructions?: string;
	diagrams?: AIDiagramAsset[];
	pages?: AIPageAsset[];
	signal?: AbortSignal;
	onProgress?: (statusText: string, progressPercent?: number) => void;
}

export interface GenerateSimilarPaperParams {
	provider: AIProvider;
	apiKey: string;
	model: string;
	blueprint: PaperBlueprint;
	sourceTestTitle?: string;
	customInstructions?: string;
	userInstructions?: string;
	targetQuestionCount?: number;
	questionCount?: number;
	durationMinutes?: number | null;
	isUntimed?: boolean;
	metadata?: AIGenerationMetadataHints;
	signal?: AbortSignal;
	onProgress?: (statusText: string, progressPercent?: number) => void;
}

export class AIService {
	/**
	 * Main entry point: Executes AI document digitization and structured question generation.
	 */
	async testify(request: TestifyExecutionRequest): Promise<AIGenerationResult> {
		const {
			provider,
			apiKey,
			model,
			extractionResult,
			answerKeyExtractionResult,
			metadata,
			onProgress,
		} = request;

		if (!apiKey?.trim()) {
			throw new Error(
				`No active API key found for ${provider}. Please configure or unlock your API key.`
			);
		}

		// 1. Prepare Document Pages
		onProgress?.('Preparing rasterized page assets...', 15);
		const pages: AIPageAsset[] = extractionResult.pages.map((p) => ({
			pageNumber: p.pageNumber,
			mimeType: 'image/png',
			dataUrl: p.rasterDataUrl,
		}));

		// 2. Prepare Isolated Diagrams Catalog
		const diagrams: AIDiagramAsset[] = extractionResult.pages.flatMap((p) =>
			p.embeddedImages.map((img) => ({
				id: img.id,
				pageNumber: img.pageNumber,
				mimeType: img.mimeType || 'image/png',
				dataUrl: img.dataUrl,
			}))
		);

		// 3. Prepare Answer Key Pages (if provided)
		let answerKeyPages: AIPageAsset[] | undefined;
		if (answerKeyExtractionResult && answerKeyExtractionResult.pages.length > 0) {
			answerKeyPages = answerKeyExtractionResult.pages.map((p) => ({
				pageNumber: p.pageNumber,
				mimeType: 'image/png',
				dataUrl: p.rasterDataUrl,
			}));
		}

		const payload: AIGenerationPayload = {
			apiKey: apiKey.trim(),
			model: model.trim(),
			pages,
			diagrams,
			answerKeyPages,
			metadata,
			onProgress,
		};

		// 4. Dispatch to unified provider adapter
		switch (provider) {
			case 'google':
				return await generateGoogleQuestions(payload);
			case 'openai':
				return await generateOpenAIQuestions(payload);
			case 'anthropic':
				return await generateAnthropicQuestions(payload);
			case 'groq':
				return await generateGroqQuestions(payload);
			default:
				throw new Error(`Unsupported AI Provider: "${provider}"`);
		}
	}

	/**
	 * Phase 1: Reverse-engineers a PaperBlueprint from an existing TestItem or structured questions.
	 */
	async generatePaperBlueprint(
		params: GeneratePaperBlueprintParams | PaperBlueprintExecutionRequest
	): Promise<PaperBlueprintResult> {
		const { provider, apiKey, model, signal, onProgress } = params;

		if (!apiKey?.trim()) {
			throw new Error(
				`No active API key found for ${provider}. Please configure or unlock your API key.`
			);
		}

		if (signal?.aborted) {
			throw new DOMException('Operation cancelled by user', 'AbortError');
		}

		let questions: any[] = [];
		let title = params.title;
		let instructions = params.instructions;

		if ('sourceTest' in params && params.sourceTest) {
			const sourceTest = params.sourceTest;
			title = title || sourceTest.title;
			instructions = instructions || sourceTest.description;
			questions = (sourceTest.questions || []).map((q) => ({
				questionNumber: q.questionNumber,
				type: q.type,
				text: q.text,
				options: q.options?.map((opt) => ({ id: opt.id, text: opt.text })),
				correctAnswer: q.correctAnswer,
				correctAnswers: q.correctAnswers,
				hint: q.hint,
				explanation: q.explanation,
				marks: q.marks,
				negativeMarks: q.negativeMarks,
				associatedDiagramId: q.associatedDiagramId,
			}));
		} else if ('questions' in params && params.questions) {
			questions = params.questions;
		}

		const payload: PaperBlueprintPayload = {
			apiKey: apiKey.trim(),
			model: model.trim(),
			questions,
			title,
			instructions,
			diagrams: params.diagrams,
			pages: params.pages,
			signal,
			onProgress,
		};

		switch (provider) {
			case 'google':
				return await generateGooglePaperBlueprint(payload);
			case 'openai':
				return await generateOpenAIPaperBlueprint(payload);
			case 'anthropic':
				return await generateAnthropicPaperBlueprint(payload);
			case 'groq':
				return await generateGroqPaperBlueprint(payload);
			default:
				throw new Error(`Unsupported AI Provider for Phase 1 blueprint: "${provider}"`);
		}
	}

	/**
	 * Phase 2: Generates an original question paper based on a PaperBlueprint.
	 */
	async generateSimilarPaper(
		params: GenerateSimilarPaperParams | SimilarPaperExecutionRequest
	): Promise<SimilarPaperGenerationResult> {
		const { provider, apiKey, model, blueprint, signal, onProgress } = params;

		if (!apiKey?.trim()) {
			throw new Error(
				`No active API key found for ${provider}. Please configure or unlock your API key.`
			);
		}

		if (signal?.aborted) {
			throw new DOMException('Operation cancelled by user', 'AbortError');
		}

		const userInstructions =
			('customInstructions' in params && params.customInstructions) ||
			('userInstructions' in params && params.userInstructions) ||
			undefined;

		const questionCount =
			('targetQuestionCount' in params && params.targetQuestionCount) ||
			('questionCount' in params && params.questionCount) ||
			undefined;

		const metadata: AIGenerationMetadataHints = ('metadata' in params && params.metadata) || {
			titleHint:
				'sourceTestTitle' in params && params.sourceTestTitle
					? `${params.sourceTestTitle} (Similar Paper)`
					: undefined,
			questionCountHint: questionCount,
			defaultDurationMinutes: 'durationMinutes' in params ? params.durationMinutes : undefined,
			isUntimed: 'isUntimed' in params ? params.isUntimed : undefined,
			defaultMarksPerQuestion: 4,
		};

		const payload: SimilarPaperGenerationPayload = {
			apiKey: apiKey.trim(),
			model: model.trim(),
			blueprint,
			userInstructions,
			questionCount,
			metadata,
			signal,
			onProgress,
		};

		switch (provider) {
			case 'google':
				return await generateGoogleSimilarPaper(payload);
			case 'openai':
				return await generateOpenAISimilarPaper(payload);
			case 'anthropic':
				return await generateAnthropicSimilarPaper(payload);
			case 'groq':
				return await generateGroqSimilarPaper(payload);
			default:
				throw new Error(`Unsupported AI Provider for Phase 2 similar paper: "${provider}"`);
		}
	}
}

export const aiService = new AIService();

export * from './parsers';
export * from './prompts';
export * from './providers/anthropic';
export * from './providers/google';
export * from './providers/groq';
export * from './providers/openai';
export * from './schemas';
export * from './similarPaperSchemas';
export * from './types';
