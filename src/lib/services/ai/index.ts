/**
 * Testify - AI Testification Unified Engine Service
 */

import type { PdfExtractionResult } from '$lib/services/pdf';
import type { AIProvider } from '$lib/types/apiKeys';
import { generateAnthropicQuestions } from './providers/anthropic';
import { generateGoogleQuestions } from './providers/google';
import { generateGroqQuestions } from './providers/groq';
import { generateOpenAIQuestions } from './providers/openai';
import type {
	AIDiagramAsset,
	AIGenerationMetadataHints,
	AIGenerationPayload,
	AIGenerationResult,
	AIPageAsset,
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
}

export const aiService = new AIService();
export * from './parsers';
export * from './prompts';
export { generateAnthropicQuestions } from './providers/anthropic';
export { generateGoogleQuestions } from './providers/google';
export { generateGroqQuestions } from './providers/groq';
export { generateOpenAIQuestions } from './providers/openai';
export * from './types';
