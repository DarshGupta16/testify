/**
 * Testify - OpenAI Provider Adapter
 */

import OpenAI from 'openai';
import type { AIGenerationPayload, AIGenerationResult } from '$lib/types/ai';
import { synthesizeAiResult } from '../parsers';
import { buildUserPrompt, TESTIFY_SYSTEM_PROMPT } from '../prompts';
import { OPENAI_STRICT_ASSESSMENT_SCHEMA } from '../schemas';

export async function generateOpenAIQuestions(
	payload: AIGenerationPayload
): Promise<AIGenerationResult> {
	payload.onProgress?.('Connecting to OpenAI API...', 10);

	const openai = new OpenAI({
		apiKey: payload.apiKey,
		dangerouslyAllowBrowser: true,
	});

	const modelName = payload.model || 'gpt-5.6-sol';
	const userPromptText = buildUserPrompt(
		payload.metadata,
		payload.diagrams,
		Boolean(payload.answerKeyPages && payload.answerKeyPages.length > 0)
	);

	payload.onProgress?.(`Sending ${payload.pages.length} document pages to ${modelName}...`, 30);

	// Construct OpenAI multimodal message content blocks
	const userContent: Array<
		| { type: 'text'; text: string }
		| { type: 'image_url'; image_url: { url: string; detail?: 'high' | 'auto' | 'low' } }
	> = [{ type: 'text', text: userPromptText }];

	// 1. Attach Document Pages
	for (const page of payload.pages) {
		userContent.push({
			type: 'image_url',
			image_url: {
				url: page.dataUrl,
				detail: 'high',
			},
		});
	}

	// 2. Attach Answer Key Pages
	if (payload.answerKeyPages && payload.answerKeyPages.length > 0) {
		for (const keyPage of payload.answerKeyPages) {
			userContent.push({
				type: 'image_url',
				image_url: {
					url: keyPage.dataUrl,
					detail: 'high',
				},
			});
		}
	}

	// 3. Attach Diagram Crops
	if (payload.diagrams && payload.diagrams.length > 0) {
		for (const diag of payload.diagrams) {
			userContent.push({
				type: 'image_url',
				image_url: {
					url: diag.dataUrl,
					detail: 'high',
				},
			});
		}
	}

	payload.onProgress?.('Extracting questions and resolving diagrams with OpenAI...', 60);

	const response = await openai.chat.completions.create({
		model: modelName,
		response_format: OPENAI_STRICT_ASSESSMENT_SCHEMA,
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

	return synthesizeAiResult('openai', modelName, rawText, payload, tokenUsage);
}
