/**
 * Testify - Anthropic Claude Provider Adapter
 */

import Anthropic from '@anthropic-ai/sdk';
import { normalizeQuestions, parseAIResponse } from '../parsers';
import { buildUserPrompt, TESTIFY_SYSTEM_PROMPT } from '../prompts';
import type { AIGenerationPayload, AIGenerationResult } from '../types';

export async function generateAnthropicQuestions(
	payload: AIGenerationPayload
): Promise<AIGenerationResult> {
	payload.onProgress?.('Connecting to Anthropic API...', 10);

	const anthropic = new Anthropic({
		apiKey: payload.apiKey,
		dangerouslyAllowBrowser: true,
	});

	const modelName = payload.model || 'claude-sonnet-5';
	const userPromptText = buildUserPrompt(
		payload.metadata,
		payload.diagrams,
		Boolean(payload.answerKeyPages && payload.answerKeyPages.length > 0)
	);

	payload.onProgress?.(`Sending ${payload.pages.length} document pages to ${modelName}...`, 30);

	type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
	type ContentBlock =
		| { type: 'text'; text: string }
		| {
				type: 'image';
				source: {
					type: 'base64';
					media_type: ImageMediaType;
					data: string;
				};
		  };

	const userContent: ContentBlock[] = [];

	// 1. Attach Document Pages
	for (const page of payload.pages) {
		const match = page.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
		if (match) {
			const mediaType = (match[1] as ImageMediaType) || 'image/png';
			userContent.push({
				type: 'image',
				source: {
					type: 'base64',
					media_type: mediaType,
					data: match[2],
				},
			});
		}
	}

	// 2. Attach Answer Key Pages
	if (payload.answerKeyPages && payload.answerKeyPages.length > 0) {
		for (const keyPage of payload.answerKeyPages) {
			const match = keyPage.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
			if (match) {
				const mediaType = (match[1] as ImageMediaType) || 'image/png';
				userContent.push({
					type: 'image',
					source: {
						type: 'base64',
						media_type: mediaType,
						data: match[2],
					},
				});
			}
		}
	}

	// 3. Attach Diagram Crops
	if (payload.diagrams && payload.diagrams.length > 0) {
		for (const diag of payload.diagrams) {
			const match = diag.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
			if (match) {
				const mediaType = (match[1] as ImageMediaType) || 'image/png';
				userContent.push({
					type: 'image',
					source: {
						type: 'base64',
						media_type: mediaType,
						data: match[2],
					},
				});
			}
		}
	}

	userContent.push({
		type: 'text',
		text: `${userPromptText}\n\nImportant: Output ONLY the valid JSON assessment object matching the schema.`,
	});

	payload.onProgress?.('Extracting questions and resolving diagrams with Claude...', 60);

	const response = await anthropic.messages.create({
		model: modelName,
		max_tokens: 8192,
		system: TESTIFY_SYSTEM_PROMPT,
		messages: [
			{
				role: 'user',
				content: userContent,
			},
		],
	});

	payload.onProgress?.('Validating questions and structuring test assessment...', 85);

	const rawText = response.content
		.filter((b) => b.type === 'text')
		.map((b) => (b as { text: string }).text)
		.join('\n');

	const parsedSchema = parseAIResponse(rawText);
	const questions = normalizeQuestions(
		parsedSchema.questions,
		payload.diagrams,
		payload.metadata?.defaultMarksPerQuestion || 4
	);

	const tokenUsage = response.usage
		? {
				promptTokens: response.usage.input_tokens,
				completionTokens: response.usage.output_tokens,
				totalTokens: response.usage.input_tokens + response.usage.output_tokens,
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
		provider: 'anthropic',
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
