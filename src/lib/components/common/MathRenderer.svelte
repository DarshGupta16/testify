<script lang="ts">
import { compileMathAndMarkdown } from '$lib/services/mathHtmlCompiler';

interface Props {
	content?: string;
	preRenderedHtml?: string;
	inline?: boolean;
	class?: string;
}

const { content = '', preRenderedHtml, inline = false, class: className = '' }: Props = $props();

const renderedHtml = $derived.by(() => {
	// 1. If pre-rendered HTML is provided (from IndexedDB / cache), render in 0ms!
	if (preRenderedHtml) {
		return preRenderedHtml;
	}

	// 2. Fallback to just-in-time compilation
	if (!content) return '';
	return compileMathAndMarkdown(content, inline);
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
