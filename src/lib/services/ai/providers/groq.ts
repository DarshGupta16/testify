/**
 * Testify - Groq Vision Provider Adapter
 */

import Groq from 'groq-sdk';
import type {
	AIGenerationPayload,
	AIGenerationResult,
	PaperBlueprintPayload,
	PaperBlueprintResult,
	SimilarPaperGenerationPayload,
	SimilarPaperGenerationResult,
} from '$lib/types/ai';
import { parsePaperBlueprint, synthesizeAiResult } from '../parsers';
import {
	buildBlueprintUserPrompt,
	buildSimilarPaperUserPrompt,
	buildUserPrompt,
	SIMILAR_PAPER_GEN_PHASE_1_PROMPT,
	SIMILAR_PAPER_GEN_PHASE_2_PROMPT,
	TESTIFY_SYSTEM_PROMPT,
} from '../prompts';

/**
 * Standard testification: extracts and digitizes questions from rasterized PDF document pages.
 */
export async function generateGroqQuestions(
	payload: AIGenerationPayload
): Promise<AIGenerationResult> {
	payload.onProgress?.('Connecting to Groq API...', 10);

	const groq = new Groq({
		apiKey: payload.apiKey,
		dangerouslyAllowBrowser: true,
	});

	const modelName = payload.model || 'qwen/qwen3.6-27b';
	const userPromptText = buildUserPrompt(
		payload.metadata,
		payload.diagrams,
		Boolean(payload.answerKeyPages && payload.answerKeyPages.length > 0)
	);

	payload.onProgress?.(
		`Sending ${payload.pages.length} document pages to Groq (${modelName})...`,
		30
	);

	const userContent: Array<
		{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
	> = [{ type: 'text', text: userPromptText }];

	// 1. Attach Document Pages
	for (const page of payload.pages) {
		userContent.push({
			type: 'text',
			text: `--- Document Page ${page.pageNumber} ---`,
		});
		userContent.push({
			type: 'image_url',
			image_url: {
				url: page.dataUrl,
			},
		});
	}

	// 2. Attach Answer Key Pages
	if (payload.answerKeyPages && payload.answerKeyPages.length > 0) {
		for (const keyPage of payload.answerKeyPages) {
			userContent.push({
				type: 'text',
				text: `--- Answer Key Page ${keyPage.pageNumber} ---`,
			});
			userContent.push({
				type: 'image_url',
				image_url: {
					url: keyPage.dataUrl,
				},
			});
		}
	}

	// 3. Attach Diagram Crops
	if (payload.diagrams && payload.diagrams.length > 0) {
		for (const diag of payload.diagrams) {
			userContent.push({
				type: 'text',
				text: `--- Diagram Crop ID: "${diag.id}" (Page ${diag.pageNumber}) ---`,
			});
			userContent.push({
				type: 'image_url',
				image_url: {
					url: diag.dataUrl,
				},
			});
		}
	}

	payload.onProgress?.('Extracting questions and resolving diagrams with Groq...', 60);

	const response = await groq.chat.completions.create({
		model: modelName,
		response_format: { type: 'json_object' },
		messages: [
			{
				role: 'system',
				content: TESTIFY_SYSTEM_PROMPT,
			},
			{
				role: 'user',
				content: userContent,
			},
		],
	});

	payload.onProgress?.('Validating questions and structuring test assessment...', 85);

	const rawText = response.choices[0]?.message?.content || '';
	const tokenUsage = response.usage
		? {
				promptTokens: response.usage.prompt_tokens,
				completionTokens: response.usage.completion_tokens,
				totalTokens: response.usage.total_tokens,
			}
		: undefined;

	return synthesizeAiResult('groq', modelName, rawText, payload, tokenUsage);
}

/**
 * Phase 1: Analyzes source question paper to extract a high-fidelity Paper Blueprint.
 */
export async function generateGroqPaperBlueprint(
	payload: PaperBlueprintPayload
): Promise<PaperBlueprintResult> {
	payload.onProgress?.('Connecting to Groq API for Blueprint analysis...', 10);

	const groq = new Groq({
		apiKey: payload.apiKey,
		dangerouslyAllowBrowser: true,
	});

	const modelName = payload.model || 'qwen/qwen3.6-27b';
	const userPromptText = buildBlueprintUserPrompt(payload);

	payload.onProgress?.(
		`Analyzing paper structure and reverse-engineering design with ${modelName}...`,
		35
	);

	const userContent: Array<
		{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
	> = [{ type: 'text', text: userPromptText }];

	if (payload.diagrams && payload.diagrams.length > 0) {
		for (const diag of payload.diagrams) {
			userContent.push({
				type: 'text',
				text: `--- Diagram Crop ID: "${diag.id}" (Page ${diag.pageNumber}) ---`,
			});
			userContent.push({
				type: 'image_url',
				image_url: {
					url: diag.dataUrl,
				},
			});
		}
	}

	if (payload.pages && payload.pages.length > 0) {
		for (const page of payload.pages) {
			userContent.push({
				type: 'text',
				text: `--- Document Page ${page.pageNumber} ---`,
			});
			userContent.push({
				type: 'image_url',
				image_url: {
					url: page.dataUrl,
				},
			});
		}
	}

	payload.onProgress?.('Synthesizing structured Paper Blueprint with Groq...', 65);

	const response = await groq.chat.completions.create({
		model: modelName,
		response_format: { type: 'json_object' },
		messages: [
			{
				role: 'system',
				content: SIMILAR_PAPER_GEN_PHASE_1_PROMPT,
			},
			{
				role: 'user',
				content: userContent,
			},
		],
	});

	payload.onProgress?.('Validating and normalizing Paper Blueprint schema...', 90);

	const rawText = response.choices[0]?.message?.content || '';
	const blueprint = parsePaperBlueprint(rawText);

	const tokenUsage = response.usage
		? {
				promptTokens: response.usage.prompt_tokens,
				completionTokens: response.usage.completion_tokens,
				totalTokens: response.usage.total_tokens,
			}
		: undefined;

	return {
		provider: 'groq',
		model: modelName,
		blueprint,
		rawResponse: rawText,
		tokenUsage,
	};
}

/**
 * Phase 2: Generates a completely new question paper based on the extracted Paper Blueprint.
 */
export async function generateGroqSimilarPaper(
	payload: SimilarPaperGenerationPayload
): Promise<SimilarPaperGenerationResult> {
	payload.onProgress?.('Connecting to Groq API for Similar Paper generation...', 10);

	const groq = new Groq({
		apiKey: payload.apiKey,
		dangerouslyAllowBrowser: true,
	});

	const modelName = payload.model || 'qwen/qwen3.6-27b';
	const userPromptText = buildSimilarPaperUserPrompt(payload);

	payload.onProgress?.(
		`Generating original questions matching blueprint philosophy with ${modelName}...`,
		40
	);

	const response = await groq.chat.completions.create({
		model: modelName,
		response_format: { type: 'json_object' },
		messages: [
			{
				role: 'system',
				content: SIMILAR_PAPER_GEN_PHASE_2_PROMPT,
			},
			{
				role: 'user',
				content: userPromptText,
			},
		],
	});

	payload.onProgress?.('Validating and normalizing generated similar paper questions...', 85);

	const rawText = response.choices[0]?.message?.content || '';
	const tokenUsage = response.usage
		? {
				promptTokens: response.usage.prompt_tokens,
				completionTokens: response.usage.completion_tokens,
				totalTokens: response.usage.total_tokens,
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

	const result = synthesizeAiResult('groq', modelName, rawText, synthPayload, tokenUsage);

	return {
		...result,
		blueprint: payload.blueprint,
	};
}
