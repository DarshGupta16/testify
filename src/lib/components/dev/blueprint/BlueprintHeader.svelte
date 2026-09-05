<script lang="ts">
import type { PaperBlueprint } from '$lib/types/blueprint';

let { blueprint, testTitle }: { blueprint: PaperBlueprint; testTitle?: string } = $props();

let isCopied = $state(false);
const archetypes = $derived(blueprint.question_archetypes || []);

function copyBlueprintJson() {
	try {
		navigator.clipboard.writeText(JSON.stringify(blueprint, null, 2));
		isCopied = true;
		setTimeout(() => (isCopied = false), 2000);
	} catch (err) {
		console.error('Failed to copy blueprint JSON:', err);
	}
}
</script>

<div class="border-b-2 border-border-color bg-muted/40 p-3 sm:p-4 shrink-0">
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
		<div class="space-y-1 min-w-0">
			<div class="flex items-center gap-2 flex-wrap">
				<span
					class="neo-badge bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-xs uppercase"
				>
					📐 Phase 1 Paper Blueprint
				</span>
				{#if blueprint.question_distribution?.total_questions}
					<span
						class="neo-badge bg-accent-contrast text-accent-contrast-text font-mono font-bold text-xs uppercase"
					>
						{blueprint.question_distribution.total_questions} Source Questions
					</span>
				{/if}
				{#if archetypes.length > 0}
					<span class="neo-badge bg-muted text-text-secondary font-mono text-xs">
						{archetypes.length} Archetypes Identified
					</span>
				{/if}
			</div>
			{#if testTitle}
				<h2 class="text-base sm:text-lg font-black truncate text-text-primary" title={testTitle}>
					{testTitle}
				</h2>
			{/if}
			{#if blueprint.paper_overview?.description}
				<p class="text-xs text-text-secondary line-clamp-2">
					{blueprint.paper_overview.description}
				</p>
			{/if}
		</div>

		<div class="flex items-center gap-2 shrink-0">
			<button
				type="button"
				onclick={copyBlueprintJson}
				class="neo-btn text-xs py-1.5 px-3 font-mono font-bold flex items-center gap-1.5 bg-surface hover:bg-muted cursor-pointer"
				aria-label="Copy Blueprint JSON to clipboard"
			>
				{#if isCopied}
					<span class="text-emerald-600 dark:text-emerald-400 font-bold" aria-hidden="true">✓</span>
					<span>Copied JSON</span>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="square"
						class="h-3.5 w-3.5 shrink-0"
						aria-hidden="true"
					>
						<rect x="9" y="9" width="13" height="13" />
						<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
					</svg>
					<span>Copy Blueprint JSON</span>
				{/if}
			</button>
		</div>
	</div>
</div>
