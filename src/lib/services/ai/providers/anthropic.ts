/**
 * Testify - Anthropic Claude Provider Adapter
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
	AIGenerationPayload,
	AIGenerationResult,
	PaperBlueprintPayload,
	PaperBlueprintResult,
	SimilarPaperGenerationPayload,
	SimilarPaperGenerationResult,
} from '$lib/types/ai';
import { parseDataUrl } from '$lib/utils/bytes';
import { parsePaperBlueprint, synthesizeAiResult } from '../parsers';
import {
	buildBlueprintUserPrompt,
	buildSimilarPaperUserPrompt,
	buildUserPrompt,
	SIMILAR_PAPER_GEN_PHASE_1_PROMPT,
	SIMILAR_PAPER_GEN_PHASE_2_PROMPT,
	TESTIFY_SYSTEM_PROMPT,
} from '../prompts';
import { ANTHROPIC_ASSESSMENT_TOOL } from '../schemas';
import { ANTHROPIC_PAPER_BLUEPRINT_TOOL } from '../similarPaperSchemas';

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

/**
 * Standard testification: extracts and digitizes questions from rasterized PDF document pages.
 */
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

	const userContent: ContentBlock[] = [];

	// 1. Attach Document Pages
	for (const page of payload.pages) {
		userContent.push({
			type: 'text',
			text: `--- Document Page ${page.pageNumber} ---`,
		});
		const parsed = parseDataUrl(page.dataUrl);
		userContent.push({
			type: 'image',
			source: {
				type: 'base64',
				media_type: (parsed.mimeType as ImageMediaType) || 'image/png',
				data: parsed.data,
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
			const parsed = parseDataUrl(keyPage.dataUrl);
			userContent.push({
				type: 'image',
				source: {
					type: 'base64',
					media_type: (parsed.mimeType as ImageMediaType) || 'image/png',
					data: parsed.data,
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
			const parsed = parseDataUrl(diag.dataUrl);
			userContent.push({
				type: 'image',
				source: {
					type: 'base64',
					media_type: (parsed.mimeType as ImageMediaType) || 'image/png',
					data: parsed.data,
				},
			});
		}
	}

	userContent.push({
		type: 'text',
		text: `${userPromptText}\n\nImportant: Synthesize the complete assessment schema.`,
	});

	payload.onProgress?.('Extracting questions and resolving diagrams with Claude...', 60);

	const response = await anthropic.messages.create({
		model: modelName,
		max_tokens: 8192,
		system: TESTIFY_SYSTEM_PROMPT,
		tools: [ANTHROPIC_ASSESSMENT_TOOL as Anthropic.Tool],
		tool_choice: { type: 'tool', name: 'synthesize_assessment' },
		messages: [
			{
				role: 'user',
				content: userContent,
			},
		],
	});

	payload.onProgress?.('Validating questions and structuring test assessment...', 85);

	let rawText = '';
	const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
	if (toolUseBlock && toolUseBlock.type === 'tool_use') {
		rawText =
			typeof toolUseBlock.input === 'string'
				? toolUseBlock.input
				: JSON.stringify(toolUseBlock.input);
	} else {
		rawText = response.content
			.filter((b) => b.type === 'text')
			.map((b) => (b as { text: string }).text)
			.join('\n');
	}

	const tokenUsage = response.usage
		? {
				promptTokens: response.usage.input_tokens,
				completionTokens: response.usage.output_tokens,
				totalTokens: response.usage.input_tokens + response.usage.output_tokens,
			}
		: undefined;

	return synthesizeAiResult('anthropic', modelName, rawText, payload, tokenUsage);
}

/**
 * Phase 1: Analyzes source question paper to extract a high-fidelity Paper Blueprint.
 */
export async function generateAnthropicPaperBlueprint(
	payload: PaperBlueprintPayload
): Promise<PaperBlueprintResult> {
	payload.onProgress?.('Connecting to Anthropic API for Blueprint analysis...', 10);

	const anthropic = new Anthropic({
		apiKey: payload.apiKey,
		dangerouslyAllowBrowser: true,
	});

	const modelName = payload.model || 'claude-sonnet-5';
	const userPromptText = buildBlueprintUserPrompt(payload);

	payload.onProgress?.(
		`Analyzing paper structure and reverse-engineering design with ${modelName}...`,
		35
	);

	const userContent: ContentBlock[] = [];

	if (payload.diagrams && payload.diagrams.length > 0) {
		for (const diag of payload.diagrams) {
			userContent.push({
				type: 'text',
				text: `--- Diagram Crop ID: "${diag.id}" (Page ${diag.pageNumber}) ---`,
			});
			const parsed = parseDataUrl(diag.dataUrl);
			userContent.push({
				type: 'image',
				source: {
					type: 'base64',
					media_type: (parsed.mimeType as ImageMediaType) || 'image/png',
					data: parsed.data,
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
			const parsed = parseDataUrl(page.dataUrl);
			userContent.push({
				type: 'image',
				source: {
					type: 'base64',
					media_type: (parsed.mimeType as ImageMediaType) || 'image/png',
					data: parsed.data,
				},
			});
		}
	}

	userContent.push({
		type: 'text',
		text: `${userPromptText}\n\nImportant: Extract the comprehensive Paper Blueprint schema.`,
	});

	payload.onProgress?.('Synthesizing structured Paper Blueprint with Claude...', 65);

	const response = await anthropic.messages.create({
		model: modelName,
		max_tokens: 8192,
		system: SIMILAR_PAPER_GEN_PHASE_1_PROMPT,
		tools: [ANTHROPIC_PAPER_BLUEPRINT_TOOL as Anthropic.Tool],
		tool_choice: { type: 'tool', name: 'extract_paper_blueprint' },
		messages: [
			{
				role: 'user',
				content: userContent,
			},
		],
	});

	payload.onProgress?.('Validating and normalizing Paper Blueprint schema...', 90);

	let rawText = '';
	const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
	if (toolUseBlock && toolUseBlock.type === 'tool_use') {
		rawText =
			typeof toolUseBlock.input === 'string'
				? toolUseBlock.input
				: JSON.stringify(toolUseBlock.input);
	} else {
		rawText = response.content
			.filter((b) => b.type === 'text')
			.map((b) => (b as { text: string }).text)
			.join('\n');
	}

	const blueprint = parsePaperBlueprint(rawText);

	const tokenUsage = response.usage
		? {
				promptTokens: response.usage.input_tokens,
				completionTokens: response.usage.output_tokens,
				totalTokens: response.usage.input_tokens + response.usage.output_tokens,
			}
		: undefined;

	return {
		provider: 'anthropic',
		model: modelName,
		blueprint,
		rawResponse: rawText,
		tokenUsage,
	};
}

/**
 * Phase 2: Generates a completely new question paper based on the extracted Paper Blueprint.
 */
export async function generateAnthropicSimilarPaper(
	payload: SimilarPaperGenerationPayload
): Promise<SimilarPaperGenerationResult> {
	payload.onProgress?.('Connecting to Anthropic API for Similar Paper generation...', 10);

	const anthropic = new Anthropic({
		apiKey: payload.apiKey,
		dangerouslyAllowBrowser: true,
	});

	const modelName = payload.model || 'claude-sonnet-5';
	const userPromptText = buildSimilarPaperUserPrompt(payload);

	payload.onProgress?.(
		`Generating original questions matching blueprint philosophy with ${modelName}...`,
		40
	);

	const response = await anthropic.messages.create({
		model: modelName,
		max_tokens: 8192,
		system: SIMILAR_PAPER_GEN_PHASE_2_PROMPT,
		tools: [ANTHROPIC_ASSESSMENT_TOOL as Anthropic.Tool],
		tool_choice: { type: 'tool', name: 'synthesize_assessment' },
		messages: [
			{
				role: 'user',
				content: [{ type: 'text', text: userPromptText }],
			},
		],
	});

	payload.onProgress?.('Validating and normalizing generated similar paper questions...', 85);

	let rawText = '';
	const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
	if (toolUseBlock && toolUseBlock.type === 'tool_use') {
		rawText =
			typeof toolUseBlock.input === 'string'
				? toolUseBlock.input
				: JSON.stringify(toolUseBlock.input);
	} else {
		rawText = response.content
			.filter((b) => b.type === 'text')
			.map((b) => (b as { text: string }).text)
			.join('\n');
	}

	const tokenUsage = response.usage
		? {
				promptTokens: response.usage.input_tokens,
				completionTokens: response.usage.output_tokens,
				totalTokens: response.usage.input_tokens + response.usage.output_tokens,
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

	const result = synthesizeAiResult('anthropic', modelName, rawText, synthPayload, tokenUsage);

	return {
		...result,
		blueprint: payload.blueprint,
	};
}
