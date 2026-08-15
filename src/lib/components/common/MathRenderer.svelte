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

const renderedHtml = $derived.by(() => {
	if (!content) return '';

	try {
		const mathPlaceholders: Map<string, string> = new Map();
		let placeholderCount = 0;

		// 0. Decode any raw unicode escape sequences (e.g. \u00c5, \u00C5, \u212B, \u00b0, etc.)
		let processed = content.replace(/(?:\\+)?u([0-9a-fA-F]{4})/g, (_, hex) => {
			try {
				return String.fromCharCode(Number.parseInt(hex, 16));
			} catch {
				return _;
			}
		});

		// 1. Extract block math $$...$$
		processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
			const id = `%%MATH_BLOCK_${placeholderCount++}%%`;
			try {
				const cleanMath = math.trim().replace(/\\\\([a-zA-Z])/g, '\\$1');
				const html = katex.renderToString(cleanMath, {
					displayMode: true,
					throwOnError: false,
				});
				mathPlaceholders.set(id, `<div class="my-2 overflow-x-auto">${html}</div>`);
			} catch {
				mathPlaceholders.set(id, `$$${math}$$`);
			}
			return id;
		});

		// 2. Extract block math \[...\]
		processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
			const id = `%%MATH_BLOCK_${placeholderCount++}%%`;
			try {
				const cleanMath = math.trim().replace(/\\\\([a-zA-Z])/g, '\\$1');
				const html = katex.renderToString(cleanMath, {
					displayMode: true,
					throwOnError: false,
				});
				mathPlaceholders.set(id, `<div class="my-2 overflow-x-auto">${html}</div>`);
			} catch {
				mathPlaceholders.set(id, `\\[${math}\\]`);
			}
			return id;
		});

		// 3. Extract inline math $...$
		processed = processed.replace(/(?<!\\)\$((?:\\\$|[^$])+?)\$/g, (_, math) => {
			const id = `%%MATH_INLINE_${placeholderCount++}%%`;
			try {
				const cleanMath = math.trim().replace(/\\\\([a-zA-Z])/g, '\\$1');
				const html = katex.renderToString(cleanMath, {
					displayMode: false,
					throwOnError: false,
				});
				mathPlaceholders.set(id, html);
			} catch {
				mathPlaceholders.set(id, `$${math}$`);
			}
			return id;
		});

		// 4. Extract inline math \(...\)
		processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
			const id = `%%MATH_INLINE_${placeholderCount++}%%`;
			try {
				const cleanMath = math.trim().replace(/\\\\([a-zA-Z])/g, '\\$1');
				const html = katex.renderToString(cleanMath, {
					displayMode: false,
					throwOnError: false,
				});
				mathPlaceholders.set(id, html);
			} catch {
				mathPlaceholders.set(id, `\\(${math}\\)`);
			}
			return id;
		});

		// 5. In the remaining prose/markdown outside math: convert literal '\n' sequences to actual newlines
		processed = processed.replace(/\\n/g, '\n').replace(/\\r/g, '');

		// 6. Parse Markdown with breaks enabled
		let parsedHtml = inline
			? (marked.parseInline(processed) as string)
			: (marked.parse(processed) as string);

		// 7. Restore Math HTML placeholders
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
