/**
 * Testify - Google Gemini Provider Adapter
 */

import { GoogleGenAI } from '@google/genai';
import type { AIGenerationPayload, AIGenerationResult } from '$lib/types/ai';
import { stripDataUrlHeader } from '$lib/utils/bytes';
import { synthesizeAiResult } from '../parsers';
import { buildUserPrompt, TESTIFY_SYSTEM_PROMPT } from '../prompts';
import { GEMINI_ASSESSMENT_SCHEMA } from '../schemas';

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
