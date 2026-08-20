<script lang="ts">
import katex from 'katex';
import { marked } from 'marked';

interface Props {
	content: string;
	inline?: boolean;
	class?: string;
}

const { content = '', inline = false, class: className = '' }: Props = $props();

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

	// 1. If it has \\& or \& or bare & outside alignment environments, replace with \text{\char38}
	const isAligned =
		/\\begin\{(matrix|aligned|cases|array|tabular|split|gather|pmatrix|bmatrix|vmatrix)\}/i.test(
			math
		);
	if (!isAligned) {
		math = math.replace(/\\+&/g, ' \\text{\\char38} ').replace(/(?<!\\)&/g, ' \\text{\\char38} ');
	}

	// 2. Normalize multiple backslashes before LaTeX commands with a single backslash
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

	// If it contains multiple common English words, it is PROSE, not a single formula
	const englishWords = trimmed.match(
		/\b(the|is|are|of|and|in|to|for|with|which|calculate|given|where|according|then|what|when|if|from|by|an|as|on|select|correct|statement|order|following|reacts|compounds|possible|element|energy|potential)\b/gi
	);
	if (englishWords && englishWords.length >= 2) {
		return false;
	}

	// If it contains LaTeX commands like \text, \frac, \sqrt, \rightarrow, \alpha, \pm, \approx, etc.
	if (
		/\\(text|frac|sqrt|rightarrow|to|alpha|beta|gamma|theta|pm|approx|times|cdot|le|ge|ne|int|sum|Delta|chi|AA)\b/i.test(
			trimmed
		)
	) {
		return true;
	}

	return false;
}

// Module-level in-memory LRU cache for rendered KaTeX formulas
const KATEX_CACHE = new Map<string, string>();
const MAX_KATEX_CACHE_ENTRIES = 2000;

function renderCachedKatex(cleanMath: string, isBlock: boolean): string {
	const cacheKey = `${isBlock ? 'B' : 'I'}:${cleanMath}`;
	const cached = KATEX_CACHE.get(cacheKey);
	if (cached !== undefined) {
		return cached;
	}

	let html = '';
	try {
		const katexHtml = katex.renderToString(cleanMath, {
			displayMode: isBlock,
			throwOnError: false,
		});
		html = isBlock ? `<div class="my-2 overflow-x-auto">${katexHtml}</div>` : katexHtml;
	} catch (err) {
		console.error('[MathRenderer] KaTeX error:', err);
		html = isBlock ? `$$${cleanMath}$$` : `$${cleanMath}$`;
	}

	if (KATEX_CACHE.size >= MAX_KATEX_CACHE_ENTRIES) {
		const oldestKey = KATEX_CACHE.keys().next().value;
		if (oldestKey) KATEX_CACHE.delete(oldestKey);
	}
	KATEX_CACHE.set(cacheKey, html);

	return html;
}

const renderedHtml = $derived.by(() => {
	if (!content) return '';

	try {
		const mathPlaceholders: Map<string, string> = new Map();
		let placeholderCount = 0;

		function storeMath(mathStr: string, isBlock = false): string {
			const id = `%%MATH_${isBlock ? 'BLOCK' : 'INLINE'}_${placeholderCount++}%%`;
			const cleanMath = sanitizeMathForKatex(mathStr);
			const html = renderCachedKatex(cleanMath, isBlock);
			mathPlaceholders.set(id, html);
			return id;
		}

		// 0. Normalize real CR/LF control characters (NOT escaped \r or \n)
		let processed = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

		// 1. Decode raw unicode escape sequences (e.g. \u00c5, \u212B, \u00b0)
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

		// 3. Extract ALL Math Blocks FIRST so that LaTeX macros (\rightarrow, \right, \rho, \nu, \nabla, etc.)
		// are completely isolated and immune to prose whitespace or markdown transformations.

		// A. Block math $$...$$
		processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => storeMath(math, true));

		// B. Block math \[...\]
		processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => storeMath(math, true));

		// C. Inline math $...$
		processed = processed.replace(/(?<!\\)\$((?:\\\$|[^$])+?)\$/g, (_, math) =>
			storeMath(math, false)
		);

		// D. Inline math \(...\)
		processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => storeMath(math, false));

		// E. Catch unwrapped mathematical formulas outside delimiters:
		// Formula terms with exponents like: 18(X_B - X_A)^{1.4} or (2)^{5/7}
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

		// Unwrapped variable subscripts like X_B, X_A, r_H, d_AB outside delimiters
		processed = processed.replace(/\b([A-Za-z])_([A-Za-z0-9]+)\b/g, (_, base, sub) => {
			return storeMath(`${base}_${sub}`, false);
		});

		// 4. In the remaining prose ONLY, convert literal '\n' escape strings to real newlines
		processed = processed.replace(/\\n/g, '\n');

		// 5. Parse Markdown with breaks enabled
		let parsedHtml = inline
			? (marked.parseInline(processed) as string)
			: (marked.parse(processed) as string);

		// 6. Restore Math HTML placeholders
		for (const [placeholder, mathHtml] of mathPlaceholders.entries()) {
			parsedHtml = parsedHtml.split(placeholder).join(mathHtml);
		}

		return parsedHtml;
	} catch (err) {
		console.error('[MathRenderer] Render error:', err);
		return content;
	}
});
</script>

{#if inline}
	<span class="math-renderer inline-content {className}">
		{@html renderedHtml}
	</span>
{:else}
	<div class="math-renderer block-content prose dark:prose-invert max-w-none text-inherit {className}">
		{@html renderedHtml}
	</div>
{/if}

<style>
	:global(.math-renderer .katex-display) {
		margin: 0.5em 0;
		overflow-x: auto;
		overflow-y: hidden;
	}
	:global(.math-renderer .katex) {
		font-size: 1.05em;
		text-rendering: auto;
	}
	:global(.math-renderer p) {
		margin-bottom: 0.5rem;
	}
	:global(.math-renderer p:last-child) {
		margin-bottom: 0;
	}
</style>
