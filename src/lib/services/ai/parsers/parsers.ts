/**
 * Testify - AI Response Parsing & Synthesis Service
 */

import { dev } from '$app/environment';
import type { AIGenerationPayload, AIGenerationResult, RawAIResponseSchema } from '$lib/types/ai';
import type { AIProvider } from '$lib/types/apiKeys';
import type { DiagramResolutionDiagnostic } from '$lib/types/devTrace';
import type { TokenUsageStats } from '$lib/types/test';
import { normalizeQuestions } from './normalizer';

/**
 * Sanitizes unescaped ASCII control characters (raw newlines, carriage returns, tabs)
 * inside JSON string literals ("..."), replacing them with standard JSON escape sequences (\n, \t).
 */
export function escapeControlCharsInJsonStrings(raw: string): string {
	let result = '';
	let inString = false;
	let isEscaped = false;

	for (let i = 0; i < raw.length; i++) {
		const ch = raw[i];

		if (isEscaped) {
			result += ch;
			isEscaped = false;
			continue;
		}

		if (ch === '\\') {
			result += ch;
			isEscaped = true;
			continue;
		}

		if (ch === '"') {
			inString = !inString;
			result += ch;
			continue;
		}

		if (inString) {
			if (ch === '\n') {
				result += '\\n';
			} else if (ch === '\r') {
				// Drop carriage return
			} else if (ch === '\t') {
				result += '\\t';
			} else {
				result += ch;
			}
		} else {
			result += ch;
		}
	}

	return result;
}

/**
 * Strips markdown code fences, trailing commas, ignores stray/mismatched closing tokens,
 * isolates the root JSON object, and auto-repairs unclosed structures if truncated.
 */
export function cleanRawJsonText(rawText: string): string {
	let text = rawText.trim();

	// 1. Strip markdown code block wrappers (```json ... ``` or ``` ...)
	const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
	const match = text.match(codeBlockRegex);
	if (match?.[1]) {
		text = match[1].trim();
	}

	// 2. Strip any preamble before the first '{'
	const firstBrace = text.indexOf('{');
	if (firstBrace !== -1) {
		text = text.substring(firstBrace);
	}

	// 3. First escape raw control characters inside string literals
	text = escapeControlCharsInJsonStrings(text);

	// 4. Remove trailing commas before object or array close braces
	text = text.replace(/,\s*([}\]])/g, '$1');

	// 5. Parse bracket/brace balance and filter out stray mismatched tokens
	let cleanedResult = '';
	const openStack: Array<'{' | '['> = [];
	let inString = false;
	let isEscaped = false;
	let rootCompleted = false;

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (isEscaped) {
			cleanedResult += ch;
			isEscaped = false;
			continue;
		}
		if (ch === '\\') {
			cleanedResult += ch;
			isEscaped = true;
			continue;
		}
		if (ch === '"') {
			inString = !inString;
			cleanedResult += ch;
			continue;
		}

		if (!inString) {
			if (ch === '{' || ch === '[') {
				openStack.push(ch);
				cleanedResult += ch;
			} else if (ch === '}') {
				if (openStack[openStack.length - 1] === '{') {
					openStack.pop();
					cleanedResult += ch;
					if (openStack.length === 0) {
						rootCompleted = true;
						break; // Root object successfully closed! Discard trailing duplicate tokens
					}
				}
				// If top of stack is NOT '{', this '}' is stray/mismatched, skip it!
			} else if (ch === ']') {
				if (openStack[openStack.length - 1] === '[') {
					openStack.pop();
					cleanedResult += ch;
				}
				// If top of stack is NOT '[', this ']' is stray/mismatched, skip it!
			} else {
				cleanedResult += ch;
			}
		} else {
			cleanedResult += ch;
		}
	}

	if (rootCompleted) {
		return cleanedResult;
	}

	// 6. If truncated mid-stream, close open string and open structures in LIFO order
	if (inString) {
		// If string ends with an unescaped backslash, double-escape it before appending '"'
		// to avoid forming an escaped quote (\") that leaves the string unterminated.
		if (isEscaped || /(?<!\\)(?:\\\\)*\\$/.test(cleanedResult)) {
			cleanedResult += '\\';
		}
		cleanedResult += '"';
	}

	cleanedResult = cleanedResult.trim().replace(/,\s*$/, '');

	while (openStack.length > 0) {
		const lastOpen = openStack.pop();
		if (lastOpen === '{') {
			cleanedResult += '\n}';
		} else if (lastOpen === '[') {
			cleanedResult += '\n]';
		}
	}

	cleanedResult = cleanedResult.replace(/,\s*([}\]])/g, '$1');
	return cleanedResult;
}

/**
 * Sanitizes unescaped LaTeX backslashes inside a raw JSON string to prevent JSON.parse
 * from failing on invalid escape characters or corrupting LaTeX macros into ASCII control characters.
 * Protects math delimiters, punctuation/spacing, and commands (e.g. \text, \frac, \beta, \rho, \theta,
 * \times, \nabla, \underline, \sum, \int, \partial, \sqrt, \alpha, \gamma, \delta, \rightarrow)
 * while preserving valid JSON escape sequences like \n, \t, \", \\ and valid Unicode \uXXXX.
 */
export function sanitizeLatexInJson(raw: string): string {
	let text = raw;

	// 1. Protect LaTeX math delimiters: \( -> \\(, \) -> \\), \[ -> \\[, \] -> \\]
	text = text.replace(/(?<!\\)\\([()[\]])/g, '\\\\$1');

	// 2. Protect math spacing, punctuation, and symbol escapes: \:, \ , \,, \;, \!, etc.
	text = text.replace(/(?<!\\)\\([: ,;!{}%&#$|^_~])/g, '\\\\$1');

	// 3. Escape any \u that is NOT followed by 4 hexadecimal digits (e.g. \underline, \uparrow, \unit)
	// preventing fatal JSON.parse "Bad Unicode escape" syntax errors.
	text = text.replace(/(?<!\\)\\u(?![0-9a-fA-F]{4})/g, '\\\\u');

	// 4. Protect LaTeX macros starting with letters that collide with standard JSON escapes (b, f, r, t, n):
	// b-macros: \beta, \begin, \bar, \binom, \big, \Big, \bullet, \bold, \boldsymbol, \bmod, etc.
	text = text.replace(
		/(?<!\\)\\(beta|begin|bar|binom|bigg?|Bigg?|bullet|bold|boldsymbol|bf|bmod|bot|box|brace|brack|breve)(?![a-zA-Z])/g,
		'\\\\$1'
	);

	// f-macros: \frac, \forall, \flat, \foot, \footnotesize, \fbox, \floor, etc.
	text = text.replace(
		/(?<!\\)\\(frac|forall|flat|foot|footnotesize|fbox|floor)(?![a-zA-Z])/g,
		'\\\\$1'
	);

	// r-macros: \rightarrow, \Rightarrow, \rho, \right, \rangle, \rad, \real, \rVert, \rbrace, \rceil, \rfloor, \root, etc.
	text = text.replace(
		/(?<!\\)\\(rightarrow|Rightarrow|rho|right|rangle|rad|real|rVert|rbrace|rceil|rfloor|root)(?![a-zA-Z])/g,
		'\\\\$1'
	);

	// t-macros: \text, \textbf, \textit, \texttt, \times, \theta, \tau, \to, \tan, \top, \triangle, \tilde, etc.
	text = text.replace(
		/(?<!\\)\\(text(?:bf|it|tt|normal)?|times|theta|tau|to|tan|tanh|top|triangle|tilde|tag|therefore|tfrac|tiny|thickapprox|thicksim|thinspace)(?![a-zA-Z])/g,
		'\\\\$1'
	);

	// n-macros in LaTeX: \nabla, \neq, \notin, \not, \nu, \natural, \naturals, etc.
	// Enumerate specific n-macros to protect genuine JSON newlines (\n) from corruption into literal \nWord.
	text = text.replace(
		/(?<!\\)\\(nabla|neq|notin|not|nu|natural|naturals|nearrow|nwarrow|normalsize|newcommand|noindent|nobreak|null|nexists|norm|ne)(?![a-zA-Z])/g,
		'\\\\$1'
	);

	// 5. Double-escape all LaTeX commands starting with any non-JSON-escape letter
	// (e.g. \alpha, \gamma, \delta, \sum, \int, \partial, \sqrt, \sin, \cos, \log, \lambda, \mu, \sigma, \omega, \pm, \approx, etc.)
	text = text.replace(/(?<!\\)\\([ac-eg-mo-qsv-zAC-Z][a-zA-Z]*)/g, '\\\\$1');

	return text;
}

/**
 * Safely parses raw string output from any LLM provider into the structured schema.
 */
export function parseAIResponse(rawText: string): RawAIResponseSchema {
	const cleaned = cleanRawJsonText(rawText);
	const sanitized = sanitizeLatexInJson(cleaned);

	try {
		const parsed = JSON.parse(sanitized);
		if (typeof parsed !== 'object' || parsed === null) {
			throw new Error('Parsed response is not a valid JSON object');
		}

		return {
			title: typeof parsed.title === 'string' ? parsed.title : undefined,
			instructions: typeof parsed.instructions === 'string' ? parsed.instructions : undefined,
			totalMarks: typeof parsed.totalMarks === 'number' ? parsed.totalMarks : undefined,
			estimatedDurationMinutes:
				typeof parsed.estimatedDurationMinutes === 'number'
					? parsed.estimatedDurationMinutes
					: undefined,
			questions: Array.isArray(parsed.questions) ? parsed.questions : [],
		};
	} catch (primaryErr) {
		// Fallback: Attempt relaxed regex recovery if standard JSON parse failed
		try {
			let fallbackText = sanitizeLatexInJson(cleaned);
			fallbackText = fallbackText.replace(/(?<!\\)\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
			const fallbackParsed = JSON.parse(fallbackText);
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
 * Standardizes AI provider raw model responses into a validated, normalized AIGenerationResult.
 * Centralizes duration computation, marks fallback calculation, and metadata hints handling.
 */
export function synthesizeAiResult(
	provider: AIProvider,
	modelName: string,
	rawText: string,
	payload: AIGenerationPayload,
	tokenUsage?: TokenUsageStats,
	durationMs?: number
): AIGenerationResult {
	const cleaned = cleanRawJsonText(rawText);
	const sanitized = sanitizeLatexInJson(cleaned);
	const parsedSchema = parseAIResponse(rawText);

	const resolutionDiagnostics: DiagramResolutionDiagnostic[] = [];
	const questions = normalizeQuestions(
		parsedSchema.questions,
		payload.diagrams,
		payload.metadata?.defaultMarksPerQuestion || 4,
		resolutionDiagnostics
	);

	let durationMinutes: number | null | undefined;
	if (payload.metadata?.isUntimed) {
		durationMinutes = null;
	} else if (payload.metadata?.defaultDurationMinutes && !payload.metadata?.autoDuration) {
		durationMinutes = payload.metadata.defaultDurationMinutes;
	} else {
		durationMinutes = parsedSchema.estimatedDurationMinutes || 60;
	}

	const diagnostics = dev
		? {
				durationMs,
				parser: {
					cleanedJsonText: cleaned,
					sanitizedJsonText: sanitized,
					parsedSchema,
				},
				normalization: {
					questionsCount: questions.length,
					diagramResolutionLogs: resolutionDiagnostics,
					finalQuestions: questions,
				},
			}
		: undefined;

	return {
		provider,
		model: modelName,
		title: parsedSchema.title || payload.metadata?.titleHint,
		instructions: parsedSchema.instructions,
		durationMinutes,
		totalMarks: parsedSchema.totalMarks || questions.reduce((acc, q) => acc + q.marks, 0),
		questions,
		rawResponse: rawText,
		tokenUsage,
		diagnostics,
	};
}
