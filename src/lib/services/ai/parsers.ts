/**
 * Testify - AI Response Parsing & Normalization Service
 */

import type { QuestionPreview } from '$lib/types/test';
import type { AIDiagramAsset, RawAIQuestion, RawAIResponseSchema } from './types';

/**
 * Strips markdown code fences, trailing commas, and formatting noise from raw model output.
 */
export function cleanRawJsonText(rawText: string): string {
	let cleaned = rawText.trim();

	// 1. Strip markdown code block wrappers (```json ... ``` or ``` ...)
	const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
	const match = cleaned.match(codeBlockRegex);
	if (match?.[1]) {
		cleaned = match[1].trim();
	}

	// 2. Locate first '{' and last '}' in case the model prefixed or suffixed prose
	const firstBrace = cleaned.indexOf('{');
	const lastBrace = cleaned.lastIndexOf('}');
	if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
		cleaned = cleaned.substring(firstBrace, lastBrace + 1);
	}

	// 3. Remove trailing commas before object or array close braces
	cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

	return cleaned;
}

/**
 * Safely parses raw string output from any LLM provider into the structured schema.
 */
export function parseAIResponse(rawText: string): RawAIResponseSchema {
	const sanitized = cleanRawJsonText(rawText);

	try {
		const parsed = JSON.parse(sanitized);
		if (typeof parsed !== 'object' || parsed === null) {
			throw new Error('Parsed response is not a valid JSON object');
		}

		return {
			title: typeof parsed.title === 'string' ? parsed.title : undefined,
			subject: typeof parsed.subject === 'string' ? parsed.subject : undefined,
			instructions: typeof parsed.instructions === 'string' ? parsed.instructions : undefined,
			totalMarks: typeof parsed.totalMarks === 'number' ? parsed.totalMarks : undefined,
			estimatedDurationMinutes:
				typeof parsed.estimatedDurationMinutes === 'number'
					? parsed.estimatedDurationMinutes
					: undefined,
			questions: Array.isArray(parsed.questions) ? parsed.questions : [],
		};
	} catch (primaryErr) {
		// Fallback: Attempt relaxed regex recovery if standard JSON parse failed due to LaTeX escapes
		try {
			const escapedLatex = sanitized.replace(/(?<!\\)\\(?!["\\/bfnrtu]|u[0-9a-fA-F]{4})/g, '\\\\');
			const fallbackParsed = JSON.parse(escapedLatex);
			if (fallbackParsed && Array.isArray(fallbackParsed.questions)) {
				return fallbackParsed as RawAIResponseSchema;
			}
		} catch {
			// Ignore fallback error and throw primary
		}

		console.error('[AI Parser] JSON Parse Error:', primaryErr, '\nRaw text:\n', rawText);
		throw new Error(
			`Failed to parse structured assessment from AI model response. (${(primaryErr as Error).message})`
		);
	}
}

/**
 * Normalizes and enriches raw AI questions with IDs, diagram URL mappings, and schema validation.
 */
export function normalizeQuestions(
	rawQuestions: RawAIQuestion[],
	diagrams?: AIDiagramAsset[],
	defaultMarks = 4
): QuestionPreview[] {
	const diagramMap = new Map<string, string>();
	if (diagrams) {
		for (const diag of diagrams) {
			diagramMap.set(diag.id, diag.dataUrl);
		}
	}

	return rawQuestions.map((q, index) => {
		const qNum = typeof q.questionNumber === 'number' ? q.questionNumber : index + 1;
		const id = `q_${qNum}_${Math.random().toString(36).substring(2, 6)}`;

		// Strict question type enforcement (only 'multiple_choice' or 'numerical')
		const rawType = String(q.type || '').toLowerCase();
		let type: 'multiple_choice' | 'numerical' = 'multiple_choice';

		if (
			rawType.includes('num') ||
			(!q.options && q.correctAnswer && !Number.isNaN(Number(q.correctAnswer)))
		) {
			type = 'numerical';
		} else {
			type = 'multiple_choice';
		}

		// Ensure options are present if multiple choice
		let options: string[] | undefined;
		if (type === 'multiple_choice') {
			if (Array.isArray(q.options) && q.options.length > 0) {
				options = q.options.map((opt) => String(opt).trim());
			} else {
				// Fallback synthesis if options were omitted
				options = [
					'A) True / Option A satisfies conditions',
					'B) False / Option B satisfies constraints',
					'C) Parameter falls within tolerance',
					'D) None of the above',
				];
			}
		}

		// Resolve diagram URL from catalog
		let associatedDiagramId = q.associatedDiagramId?.trim() || undefined;
		let associatedDiagramUrl: string | undefined;

		if (associatedDiagramId) {
			associatedDiagramUrl = diagramMap.get(associatedDiagramId);
			if (!associatedDiagramUrl) {
				// If ID was mismatched, attempt fuzzy match
				const queryId = associatedDiagramId.toLowerCase();
				const matchedKey = Array.from(diagramMap.keys()).find((k) =>
					k.toLowerCase().includes(queryId)
				);
				if (matchedKey) {
					associatedDiagramId = matchedKey;
					associatedDiagramUrl = diagramMap.get(matchedKey);
				}
			}
		}

		const marks = typeof q.marks === 'number' && q.marks > 0 ? q.marks : defaultMarks;
		const negativeMarks = typeof q.negativeMarks === 'number' ? q.negativeMarks : 0;

		return {
			id,
			questionNumber: qNum,
			type,
			text: String(q.text || `Question ${qNum}`).trim(),
			options,
			correctAnswer: q.correctAnswer ? String(q.correctAnswer).trim() : undefined,
			explanation: q.explanation ? String(q.explanation).trim() : undefined,
			marks,
			negativeMarks,
			associatedDiagramId,
			associatedDiagramUrl,
			pageNumber: typeof q.pageNumber === 'number' ? q.pageNumber : undefined,
		};
	});
}

/**
 * Formats API errors from various AI providers into clear, user-friendly, actionable diagnostic messages.
 */
export function formatAiProviderError(provider: string, err: unknown): string {
	const rawMessage = err instanceof Error ? err.message : String(err);
	const lower = rawMessage.toLowerCase();
	const providerUpper = provider.toUpperCase();

	// 1. Specific Provider Vision Limits (e.g. Groq 3-image ceiling)
	if (
		provider === 'groq' &&
		(lower.includes('too many images') || lower.includes('supports up to 3 images'))
	) {
		return 'Groq Vision Limit: The selected model (qwen3.6-27b) currently accepts a maximum of 3 images (pages + diagrams) per request. Please try a shorter document or use Google Gemini / OpenAI. If this is unexpected, please contact the developer.';
	}

	// 2. Quota / Rate Limits (429 / Resource Exhausted)
	if (
		lower.includes('quota') ||
		lower.includes('rate limit') ||
		lower.includes('429') ||
		lower.includes('resource_exhausted') ||
		lower.includes('credit')
	) {
		return `${providerUpper} Quota Exceeded (429): Your API usage quota or credits have been exhausted. Please verify your billing balance in your provider console or switch to another provider.`;
	}

	// 3. Authentication & Key Errors (401 / 403)
	if (
		lower.includes('401') ||
		lower.includes('403') ||
		lower.includes('unauthorized') ||
		lower.includes('invalid_api_key') ||
		lower.includes('permission_denied') ||
		lower.includes('api key not valid')
	) {
		return `${providerUpper} Authentication Error: The provided API key is invalid, unauthorized, or expired. Please update your key in the API Keys settings.`;
	}

	// 4. Model not found / Unsupported
	if (
		lower.includes('not found') ||
		lower.includes('model_not_found') ||
		lower.includes('unsupported model')
	) {
		return `${providerUpper} Model Error: The selected model is not available or does not support multimodal vision. Please choose a recommended model preset or contact the developer.`;
	}

	// 5. Context length / Payload size
	if (
		lower.includes('context_length_exceeded') ||
		lower.includes('maximum context') ||
		lower.includes('payload too large') ||
		lower.includes('413')
	) {
		return `${providerUpper} Payload Error: Document size exceeded the model's context window. Try lowering the extraction resolution scale or using Gemini 3.7 Flash.`;
	}

	// 6. JSON error message extraction
	try {
		const jsonMatch = rawMessage.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			if (parsed.error?.message) {
				return `${providerUpper} Error: ${parsed.error.message}. Please check your settings or contact the developer if needed.`;
			}
		}
	} catch {
		// Ignore JSON extraction failure
	}

	return `${providerUpper} Error: ${rawMessage}. If this issue persists, please contact the developer.`;
}
