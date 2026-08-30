/**
 * Testify - Google Gemini Provider Adapter
 */

import { GoogleGenAI } from '@google/genai';
import type {
	AIGenerationPayload,
	AIGenerationResult,
	PaperBlueprintPayload,
	PaperBlueprintResult,
	SimilarPaperGenerationPayload,
	SimilarPaperGenerationResult,
} from '$lib/types/ai';
import { stripDataUrlHeader } from '$lib/utils/bytes';
import { parsePaperBlueprint, synthesizeAiResult } from '../parsers';
import {
	buildBlueprintUserPrompt,
	buildSimilarPaperUserPrompt,
	buildUserPrompt,
	SIMILAR_PAPER_GEN_PHASE_1_PROMPT,
	SIMILAR_PAPER_GEN_PHASE_2_PROMPT,
	TESTIFY_SYSTEM_PROMPT,
} from '../prompts';
import { GEMINI_ASSESSMENT_SCHEMA } from '../schemas';
import { GEMINI_PAPER_BLUEPRINT_SCHEMA } from '../similarPaperSchemas';

/**
 * Standard testification: extracts and digitizes questions from rasterized PDF document pages.
 */
export async function generateGoogleQuestions(
	payload: AIGenerationPayload
): Promise<AIGenerationResult> {
	payload.onProgress?.('Connecting to Google Gemini...', 10);

	const ai = new GoogleGenAI({ apiKey: payload.apiKey });
	const modelName = payload.model || 'gemini-3.7-flash';

	const userPromptText = buildUserPrompt(
		payload.metadata,
		payload.diagrams,
		Boolean(payload.answerKeyPages && payload.answerKeyPages.length > 0)
	);

	payload.onProgress?.(`Sending ${payload.pages.length} document pages to ${modelName}...`, 30);

	const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
	parts.push({ text: userPromptText });

	// 1. Attach Document Pages
	for (const page of payload.pages) {
		parts.push({
			text: `--- Document Page ${page.pageNumber} ---`,
		});
		parts.push({
			inlineData: {
				mimeType: page.mimeType || 'image/png',
				data: stripDataUrlHeader(page.dataUrl),
			},
		});
	}

	// 2. Attach Answer Key Pages (if provided)
	if (payload.answerKeyPages && payload.answerKeyPages.length > 0) {
		for (const keyPage of payload.answerKeyPages) {
			parts.push({
				text: `--- Answer Key Page ${keyPage.pageNumber} ---`,
			});
			parts.push({
				inlineData: {
					mimeType: keyPage.mimeType || 'image/png',
					data: stripDataUrlHeader(keyPage.dataUrl),
				},
			});
		}
	}

	// 3. Attach Diagram Crops (if provided)
	if (payload.diagrams && payload.diagrams.length > 0) {
		for (const diag of payload.diagrams) {
			parts.push({
				text: `--- Diagram Crop ID: "${diag.id}" (Page ${diag.pageNumber}) ---`,
			});
			parts.push({
				inlineData: {
					mimeType: diag.mimeType || 'image/png',
					data: stripDataUrlHeader(diag.dataUrl),
				},
			});
		}
	}

	payload.onProgress?.('Extracting questions and resolving diagrams with Gemini...', 60);

	const response = await ai.models.generateContent({
		model: modelName,
		contents: [
			{
				role: 'user',
				parts: parts,
			},
		],
		config: {
			systemInstruction: TESTIFY_SYSTEM_PROMPT,
			responseMimeType: 'application/json',
			responseSchema: GEMINI_ASSESSMENT_SCHEMA,
		},
	});

	payload.onProgress?.('Validating questions and structuring test assessment...', 85);

	const rawText = response.text || '';
	const tokenUsage = response.usageMetadata
		? {
				promptTokens: response.usageMetadata.promptTokenCount,
				completionTokens: response.usageMetadata.candidatesTokenCount,
				totalTokens: response.usageMetadata.totalTokenCount,
			}
		: undefined;

	return synthesizeAiResult('google', modelName, rawText, payload, tokenUsage);
}

/**
 * Phase 1: Analyzes source question paper to extract a high-fidelity Paper Blueprint.
 */
export async function generateGooglePaperBlueprint(
	payload: PaperBlueprintPayload
): Promise<PaperBlueprintResult> {
	payload.onProgress?.('Connecting to Google Gemini for Blueprint analysis...', 10);

	const ai = new GoogleGenAI({ apiKey: payload.apiKey });
	const modelName = payload.model || 'gemini-3.7-flash';

	const userPromptText = buildBlueprintUserPrompt(payload);
	payload.onProgress?.(
		`Analyzing paper structure and reverse-engineering design with ${modelName}...`,
		35
	);

	const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
	parts.push({ text: userPromptText });

	if (payload.diagrams && payload.diagrams.length > 0) {
		for (const diag of payload.diagrams) {
			parts.push({
				text: `--- Diagram Crop ID: "${diag.id}" (Page ${diag.pageNumber}) ---`,
			});
			parts.push({
				inlineData: {
					mimeType: diag.mimeType || 'image/png',
					data: stripDataUrlHeader(diag.dataUrl),
				},
			});
		}
	}

	if (payload.pages && payload.pages.length > 0) {
		for (const page of payload.pages) {
			parts.push({
				text: `--- Document Page ${page.pageNumber} ---`,
			});
			parts.push({
				inlineData: {
					mimeType: page.mimeType || 'image/png',
					data: stripDataUrlHeader(page.dataUrl),
				},
			});
		}
	}

	payload.onProgress?.('Synthesizing structured Paper Blueprint with Gemini...', 65);

	const response = await ai.models.generateContent({
		model: modelName,
		contents: [
			{
				role: 'user',
				parts,
			},
		],
		config: {
			systemInstruction: SIMILAR_PAPER_GEN_PHASE_1_PROMPT,
			responseMimeType: 'application/json',
			responseSchema: GEMINI_PAPER_BLUEPRINT_SCHEMA,
		},
	});

	payload.onProgress?.('Validating and normalizing Paper Blueprint schema...', 90);

	const rawText = response.text || '';
	const blueprint = parsePaperBlueprint(rawText);

	const tokenUsage = response.usageMetadata
		? {
				promptTokens: response.usageMetadata.promptTokenCount,
				completionTokens: response.usageMetadata.candidatesTokenCount,
				totalTokens: response.usageMetadata.totalTokenCount,
			}
		: undefined;

	return {
		provider: 'google',
		model: modelName,
		blueprint,
		rawResponse: rawText,
		tokenUsage,
	};
}

/**
 * Phase 2: Generates a completely new question paper based on the extracted Paper Blueprint.
 */
export async function generateGoogleSimilarPaper(
	payload: SimilarPaperGenerationPayload
): Promise<SimilarPaperGenerationResult> {
	payload.onProgress?.('Connecting to Google Gemini for Similar Paper generation...', 10);

	const ai = new GoogleGenAI({ apiKey: payload.apiKey });
	const modelName = payload.model || 'gemini-3.7-flash';

	const userPromptText = buildSimilarPaperUserPrompt(payload);
	payload.onProgress?.(
		`Generating original questions matching blueprint philosophy with ${modelName}...`,
		40
	);

	const response = await ai.models.generateContent({
		model: modelName,
		contents: [
			{
				role: 'user',
				parts: [{ text: userPromptText }],
			},
		],
		config: {
			systemInstruction: SIMILAR_PAPER_GEN_PHASE_2_PROMPT,
			responseMimeType: 'application/json',
			responseSchema: GEMINI_ASSESSMENT_SCHEMA,
		},
	});

	payload.onProgress?.('Validating and normalizing generated similar paper questions...', 85);

	const rawText = response.text || '';
	const tokenUsage = response.usageMetadata
		? {
				promptTokens: response.usageMetadata.promptTokenCount,
				completionTokens: response.usageMetadata.candidatesTokenCount,
				totalTokens: response.usageMetadata.totalTokenCount,
			}
		: undefined;

	const synthPayload: AIGenerationPayload = {
		apiKey: payload.apiKey,
		model: modelName,
		pages: [],
		metadata: payload.metadata || {
			questionCountHint: payload.questionCount,
			titleHint: payload.userInstructions ? undefined : 'Similar Practice Assessment',
		},
		onProgress: payload.onProgress,
	};

	const result = synthesizeAiResult('google', modelName, rawText, synthPayload, tokenUsage);

	return {
		...result,
		blueprint: payload.blueprint,
	};
}
