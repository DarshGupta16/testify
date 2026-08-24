/**
 * Math & Markdown Pre-compilation Engine
 *
 * Pre-renders KaTeX mathematical formulas and Markdown formatting into pure HTML strings.
 * Storing pre-rendered HTML in IndexedDB avoids synchronous KaTeX parsing on the UI thread,
 * ensuring instantaneous component mounting and sub-10ms INP metrics.
 */

import katex from 'katex';
import { marked } from 'marked';
import type { QuestionOption, QuestionPreview } from '$lib/types/test';

// Configure marked for clean GFM rendering
marked.use({
	gfm: true,
	breaks: true,
});

/**
 * Sanitizes math content before sending to KaTeX:
 * 1. Replaces illegal ampersands outside matrices with \text{\char38}
 * 2. Normalizes multiple backslashes before LaTeX commands
 */
function sanitizeMathForKatex(rawMath: string): string {
	let math = rawMath.trim();

	const isAligned =
		/\\begin\{(matrix|aligned|cases|array|tabular|split|gather|pmatrix|bmatrix|vmatrix)\}/i.test(
			math
		);
	if (!isAligned) {
		math = math.replace(/\\+&/g, ' \\text{\\char38} ').replace(/(?<!\\)&/g, ' \\text{\\char38} ');
	}

	math = math.replace(/\\\\+([a-zA-Z])/g, (_, g1) => `\\${g1}`);
	return math;
}

/**
 * Determines if an entire text string is an isolated standalone formula
 * (e.g. `\text{H}^+ + \\& \text{H}` or `\frac{a}{b}`) rather than English prose.
 */
function isPureMathExpression(str: string): boolean {
	const trimmed = str.trim();
	if (/(\$\$|\\\[|\$|\\\()/.test(trimmed)) return false;

	const englishWords = trimmed.match(
		/\b(the|is|are|of|and|in|to|for|with|which|calculate|given|where|according|then|what|when|if|from|by|an|as|on|select|correct|statement|order|following|reacts|compounds|possible|element|energy|potential)\b/gi
	);
	if (englishWords && englishWords.length >= 2) {
		return false;
	}

	if (
		/\\(text|frac|sqrt|rightarrow|to|alpha|beta|gamma|theta|pm|approx|times|cdot|le|ge|ne|int|sum|Delta|chi|AA)\b/i.test(
			trimmed
		)
	) {
		return true;
	}

	return false;
}

/**
 * Renders LaTeX formulas directly on demand via KaTeX.
 */
function renderKatex(cleanMath: string, isBlock: boolean): string {
	try {
		const katexHtml = katex.renderToString(cleanMath, {
			displayMode: isBlock,
			throwOnError: false,
		});
		return isBlock ? `<div class="my-2 overflow-x-auto">${katexHtml}</div>` : katexHtml;
	} catch (err) {
		console.error('[MathHtmlCompiler] KaTeX error:', err);
		return isBlock ? `$$${cleanMath}$$` : `$${cleanMath}$`;
	}
}

/**
 * Compiles raw LaTeX and Markdown into sanitised, render-ready HTML.
 */
export function compileMathAndMarkdown(content: string, inline = false): string {
	if (!content) return '';

	try {
		const mathPlaceholders: Map<string, string> = new Map();
		let placeholderCount = 0;

		function storeMath(mathStr: string, isBlock = false): string {
			const id = `%%MATH_${isBlock ? 'BLOCK' : 'INLINE'}_${placeholderCount++}%%`;
			const cleanMath = sanitizeMathForKatex(mathStr);
			const html = renderKatex(cleanMath, isBlock);
			mathPlaceholders.set(id, html);
			return id;
		}

		// 0. Normalize real CR/LF control characters
		let processed = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

		// 1. Decode raw unicode escape sequences
		processed = processed.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
			try {
				return String.fromCharCode(Number.parseInt(hex, 16));
			} catch {
				return _;
			}
		});

		// 2. Auto-wrap isolated pure LaTeX formulas lacking delimiters
		if (isPureMathExpression(processed)) {
			processed = `$${processed.trim()}$`;
		}

		// 3. Extract Math Blocks (Block & Inline delimiters)
		processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => storeMath(math, true));
		processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => storeMath(math, true));
		processed = processed.replace(/(?<!\\)\$((?:\\\$|[^$])+?)\$/g, (_, math) =>
			storeMath(math, false)
		);
		processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => storeMath(math, false));

		// Unwrapped exponents / subscripts outside delimiters
		processed = processed.replace(
			/(?:\b|\()([A-Za-z0-9_()\-+\s]+?)\^\{([^}]+)\}/g,
			(match, base, exp) => {
				const words = base.trim().match(/\b[A-Za-z]{3,}\b/g) || [];
				if (words.length <= 1) {
					return storeMath(`${base.trim()}^{${exp}}`, false);
				}
				return match;
			}
		);
		processed = processed.replace(/\b([A-Za-z])_([A-Za-z0-9]+)\b/g, (_, base, sub) => {
			return storeMath(`${base}_${sub}`, false);
		});

		// 4. In remaining prose, convert literal '\n' strings to real newlines
		processed = processed.replace(/\\n/g, '\n');

		// 5. Parse Markdown
		const parsedHtml = inline
			? (marked.parseInline(processed) as string)
			: (marked.parse(processed) as string);

		// 6. Restore Math HTML placeholders using a single-pass regex replacement
		return parsedHtml.replace(
			/%%MATH_(?:BLOCK|INLINE)_\d+%%/g,
			(id) => mathPlaceholders.get(id) || id
		);
	} catch (err) {
		console.error('[MathHtmlCompiler] Compile error:', err);
		return content;
	}
}

/**
 * Precompiles all LaTeX math & Markdown fields for a single QuestionPreview item.
 */
export function precompileQuestionMath(question: QuestionPreview): QuestionPreview {
	const compiledQuestion: QuestionPreview = {
		...question,
		renderedTextHtml: compileMathAndMarkdown(question.text, false),
		renderedHintHtml: question.hint ? compileMathAndMarkdown(question.hint, false) : undefined,
		renderedExplanationHtml: question.explanation
			? compileMathAndMarkdown(question.explanation, false)
			: undefined,
	};

	if (question.options && question.options.length > 0) {
		compiledQuestion.options = question.options.map((opt: QuestionOption) => ({
			...opt,
			renderedTextHtml: compileMathAndMarkdown(opt.text, true),
		}));
	}

	return compiledQuestion;
}

/**
 * Precompiles an array of questions.
 */
export function precompileQuestionsMath(questions: QuestionPreview[]): QuestionPreview[] {
	if (!questions || questions.length === 0) return [];
	return questions.map(precompileQuestionMath);
}
