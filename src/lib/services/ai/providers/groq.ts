/**
 * Testify - Groq Vision Provider Adapter
 */

import Groq from 'groq-sdk';
import { normalizeQuestions, parseAIResponse } from '../parsers';
import { buildUserPrompt, TESTIFY_SYSTEM_PROMPT } from '../prompts';
import type { AIGenerationPayload, AIGenerationResult } from '../types';

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
		provider: 'groq',
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
