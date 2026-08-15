/**
 * Testify - OpenAI Provider Adapter
 */

import OpenAI from 'openai';
import { normalizeQuestions, parseAIResponse } from '../parsers';
import { buildUserPrompt, TESTIFY_SYSTEM_PROMPT } from '../prompts';
import type { AIGenerationPayload, AIGenerationResult } from '../types';

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
	const parsedSchema = parseAIResponse(rawText);
	const questions = normalizeQuestions(
		parsedSchema.questions,
		payload.diagrams,
		payload.metadata?.defaultMarksPerQuestion || 4
	);

	const tokenUsage = response.usage
		? {
				promptTokens: response.usage.prompt_tokens,
				completionTokens: response.usage.completion_tokens,
				totalTokens: response.usage.total_tokens,
			}
		: undefined;

	let durationMinutes: number | null | undefined;
	if (payload.metadata?.isUntimed) {
		durationMinutes = null;
	} else if (payload.metadata?.defaultDurationMinutes && !payload.metadata?.autoDuration) {
		durationMinutes = payload.metadata.defaultDurationMinutes;
	} else {
		durationMinutes = parsedSchema.estimatedDurationMinutes || 60;
	}

	return {
		provider: 'openai',
		model: modelName,
		title: parsedSchema.title || payload.metadata?.titleHint,
		subject: parsedSchema.subject || payload.metadata?.subjectHint,
		instructions: parsedSchema.instructions,
		durationMinutes,
		totalMarks: parsedSchema.totalMarks || questions.reduce((acc, q) => acc + q.marks, 0),
		questions,
		rawResponse: rawText,
		tokenUsage,
	};
}
