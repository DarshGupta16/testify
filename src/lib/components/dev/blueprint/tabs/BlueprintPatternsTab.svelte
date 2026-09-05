<script lang="ts">
import MathRenderer from '$lib/components/common/MathRenderer.svelte';
import type { PaperBlueprint } from '$lib/types/blueprint';

let { blueprint }: { blueprint: PaperBlueprint } = $props();

const patterns = $derived(blueprint.surface_vs_deep_patterns || []);
</script>

{#if patterns.length === 0}
	<div
		class="p-8 text-center font-mono text-xs text-text-muted border-2 border-dashed border-border-color"
	>
		No surface vs deep pattern mappings recorded.
	</div>
{:else}
	<div class="space-y-3 max-w-4xl font-mono text-xs">
		{#each patterns as pat, idx}
			<div class="neo-box p-4 bg-surface border-2 border-border-color space-y-2.5">
				<div class="flex items-center justify-between border-b border-border-color/30 pb-1.5">
					<span class="font-bold uppercase text-text-primary">Pattern #{idx + 1}</span>
				</div>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div class="p-2.5 bg-rose-500/10 border border-rose-500/30 space-y-1">
						<span
							class="text-[10px] text-rose-800 dark:text-rose-300 uppercase font-bold block mb-1"
						>
							Surface Observation (Do Not Copy Literally)
						</span>
						{#if pat.surface_pattern}
							<MathRenderer
								content={pat.surface_pattern}
								inline={true}
								class="text-text-secondary"
							/>
						{/if}
					</div>
					<div class="p-2.5 bg-emerald-500/10 border border-emerald-500/30 space-y-1">
						<span
							class="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase font-bold block mb-1"
						>
							Deep Underlying Structure (Preserve This)
						</span>
						{#if pat.deep_pattern}
							<MathRenderer
								content={pat.deep_pattern}
								inline={true}
								class="text-text-primary font-bold"
							/>
						{/if}
					</div>
				</div>
				{#if pat.generation_instruction}
					<div class="p-2.5 bg-muted/40 border border-border-color space-y-0.5">
						<span class="text-[10px] text-text-muted uppercase font-bold block mb-1">
							Generation Directive
						</span>
						<MathRenderer
							content={pat.generation_instruction}
							inline={true}
							class="text-text-primary"
						/>
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}
