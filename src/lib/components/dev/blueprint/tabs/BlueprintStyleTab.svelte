<script lang="ts">
import type { PaperBlueprint } from '$lib/types/blueprint';

let { blueprint }: { blueprint: PaperBlueprint } = $props();

const hasStyleData = $derived(
	Boolean(
		blueprint.writing_style ||
			blueprint.distractor_patterns?.length ||
			blueprint.sequencing_and_structure
	)
);
</script>

{#if !hasStyleData}
	<div
		class="p-8 text-center font-mono text-xs text-text-muted border-2 border-dashed border-border-color"
	>
		No writing style specifications or patterns recorded in this blueprint.
	</div>
{:else}
	<div class="space-y-4 max-w-4xl font-mono text-xs">
		<!-- Writing Style Specifications -->
		{#if blueprint.writing_style}
			<div class="neo-box p-4 bg-surface border-2 border-border-color space-y-3">
				<span class="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
					Writing Style Specifications
				</span>
				<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
					{#each Object.entries(blueprint.writing_style) as [key, val]}
						{#if typeof val === 'string' && val}
							<div class="p-2.5 bg-muted/30 border border-border-color space-y-0.5">
								<span class="text-[10px] text-text-muted uppercase block font-bold">
									{key.replace(/_/g, ' ')}
								</span>
								<span class="text-text-primary font-bold">{val}</span>
							</div>
						{/if}
					{/each}
				</div>

				<!-- Recurring Linguistic & Structural Patterns -->
				{#if blueprint.writing_style.recurring_linguistic_patterns?.length}
					<div class="mt-3 pt-3 border-t border-border-color/30 space-y-1.5">
						<span class="text-[10px] text-text-muted uppercase block font-bold">
							Recurring Linguistic & Structural Patterns
						</span>
						<ul class="space-y-1">
							{#each blueprint.writing_style.recurring_linguistic_patterns as pattern}
								<li class="flex items-start gap-2 text-text-primary">
									<span class="text-indigo-600 dark:text-indigo-400 font-bold shrink-0">✦</span>
									<span class="leading-relaxed">{pattern}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Distractor Construction Patterns -->
		{#if blueprint.distractor_patterns?.length}
			<div class="neo-box p-4 bg-muted/20 border-2 border-border-color space-y-2">
				<span class="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
					Distractor Construction Patterns
				</span>
				<ul class="space-y-1.5">
					{#each blueprint.distractor_patterns as dist}
						<li class="flex items-start gap-2">
							<span class="text-indigo-600 dark:text-indigo-400 font-bold shrink-0">✦</span>
							<span class="text-text-primary leading-relaxed">
								{typeof dist === 'string' ? dist : JSON.stringify(dist)}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- Sequencing & Structure -->
		{#if blueprint.sequencing_and_structure}
			<div class="neo-box p-4 bg-surface border-2 border-border-color space-y-2">
				<span class="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
					Sequencing & Ordering Patterns
				</span>
				{#if blueprint.sequencing_and_structure.section_structure}
					<p class="text-text-primary mb-2 font-medium">
						{blueprint.sequencing_and_structure.section_structure}
					</p>
				{/if}
				{#if blueprint.sequencing_and_structure.ordering_patterns?.length}
					<ul class="space-y-1">
						{#each blueprint.sequencing_and_structure.ordering_patterns as ord}
							<li class="flex items-start gap-2">
								<span class="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">→</span>
								<span class="text-text-secondary leading-relaxed">{ord}</span>
							</li>
						{/each}
					</ul>
				{/if}
				{#if blueprint.sequencing_and_structure.progression_patterns?.length}
					<div class="mt-2 pt-2 border-t border-border-color/30 space-y-1">
						<span class="text-[10px] text-text-muted uppercase block font-bold">
							Progression Patterns
						</span>
						<ul class="space-y-1">
							{#each blueprint.sequencing_and_structure.progression_patterns as prog}
								<li class="flex items-start gap-2">
									<span class="text-indigo-600 dark:text-indigo-400 font-bold shrink-0">↗</span>
									<span class="text-text-secondary leading-relaxed">{prog}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
