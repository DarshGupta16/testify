/**
 * Testify - AI Provider Error Diagnostic Service
 */

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
