<script lang="ts">
import MathRenderer from '$lib/components/common/MathRenderer.svelte';
import type { PaperBlueprint } from '$lib/types/blueprint';

let { blueprint }: { blueprint: PaperBlueprint } = $props();

let selectedArchetypeIndex = $state<number>(0);

const archetypes = $derived(blueprint.question_archetypes || []);
const activeArchetype = $derived(archetypes[selectedArchetypeIndex] || archetypes[0]);
</script>

{#if archetypes.length === 0}
	<div
		class="p-8 text-center font-mono text-xs text-text-muted border-2 border-dashed border-border-color"
	>
		No question archetypes recorded in this blueprint.
	</div>
{:else}
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<!-- Archetype Selector List -->
		<div class="space-y-1.5 md:border-r-2 md:border-border-color pr-2">
			<span
				class="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted block mb-2"
			>
				Archetypes ({archetypes.length})
			</span>
			{#each archetypes as arch, idx}
				<button
					type="button"
					onclick={() => (selectedArchetypeIndex = idx)}
					class={`w-full text-left p-2.5 border-2 border-border-color text-xs font-mono transition-all cursor-pointer ${
						selectedArchetypeIndex === idx
							? '!bg-accent-contrast !text-accent-contrast-text font-bold shadow-[2px_2px_0px_var(--shadow-color)] translate-x-[1px] translate-y-[1px]'
							: 'bg-surface hover:bg-muted/60 text-text-primary shadow-[3px_3px_0px_var(--shadow-color)] hover:-translate-y-0.5'
					}`}
				>
					<div class="flex items-center justify-between gap-1 mb-1">
						<span class="font-bold truncate">{arch.name || `Archetype ${idx + 1}`}</span>
						{#if arch.count || arch.percentage}
							<span
								class={`text-[10px] shrink-0 ${selectedArchetypeIndex === idx ? 'opacity-90' : 'text-text-muted'}`}
							>
								{arch.count ? `${arch.count} Qs` : ''}
								{arch.percentage ? `(${arch.percentage}%)` : ''}
							</span>
						{/if}
					</div>
					{#if arch.description}
						<p
							class={`text-[10px] line-clamp-2 leading-snug ${selectedArchetypeIndex === idx ? 'opacity-85' : 'text-text-secondary'}`}
						>
							{arch.description}
						</p>
					{/if}
				</button>
			{/each}
		</div>

		<!-- Selected Archetype Detail View -->
		<div class="md:col-span-2 space-y-3">
			{#if activeArchetype}
				<div class="neo-box p-4 bg-muted/20 border-2 border-border-color space-y-3">
					<div class="flex items-start justify-between gap-2 border-b border-border-color/30 pb-2">
						<div>
							<h3 class="text-base font-black text-text-primary uppercase tracking-tight">
								{activeArchetype.name || 'Archetype Detail'}
							</h3>
							{#if activeArchetype.description}
								<div class="text-xs text-text-secondary mt-0.5">
									<MathRenderer content={activeArchetype.description} inline={true} />
								</div>
							{/if}
						</div>
						{#if activeArchetype.representative_question_ids?.length}
							<div class="text-right font-mono text-[10px] text-text-muted shrink-0">
								<span>Ref IDs:</span>
								<span class="font-bold text-text-primary"
									>{activeArchetype.representative_question_ids.join(', ')}</span
								>
							</div>
						{/if}
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-xs">
						{#if activeArchetype.what_is_tested}
							<div class="p-2.5 bg-surface border border-border-color">
								<span class="text-[10px] text-text-muted uppercase block font-bold mb-1"
									>What Is Tested</span
								>
								<MathRenderer
									content={activeArchetype.what_is_tested}
									inline={true}
									class="text-text-primary"
								/>
							</div>
						{/if}
						{#if activeArchetype.how_it_is_tested}
							<div class="p-2.5 bg-surface border border-border-color">
								<span class="text-[10px] text-text-muted uppercase block font-bold mb-1"
									>How It Is Tested</span
								>
								<MathRenderer
									content={activeArchetype.how_it_is_tested}
									inline={true}
									class="text-text-primary"
								/>
							</div>
						{/if}
						{#if activeArchetype.reasoning_pattern}
							<div class="p-2.5 bg-surface border border-border-color">
								<span class="text-[10px] text-text-muted uppercase block font-bold mb-1"
									>Reasoning Pattern</span
								>
								<MathRenderer
									content={activeArchetype.reasoning_pattern}
									inline={true}
									class="text-text-primary"
								/>
							</div>
						{/if}
						{#if activeArchetype.conceptual_application_depth}
							<div class="p-2.5 bg-surface border border-border-color">
								<span class="text-[10px] text-text-muted uppercase block font-bold mb-1"
									>Conceptual Depth</span
								>
								<MathRenderer
									content={activeArchetype.conceptual_application_depth}
									inline={true}
									class="text-text-primary"
								/>
							</div>
						{/if}
						{#if activeArchetype.linguistic_pattern}
							<div class="p-2.5 bg-surface border border-border-color">
								<span class="text-[10px] text-text-muted uppercase block font-bold mb-1"
									>Linguistic Pattern</span
								>
								<MathRenderer
									content={activeArchetype.linguistic_pattern}
									inline={true}
									class="text-text-primary"
								/>
							</div>
						{/if}
						{#if activeArchetype.structural_pattern}
							<div class="p-2.5 bg-surface border border-border-color">
								<span class="text-[10px] text-text-muted uppercase block font-bold mb-1"
									>Structural Pattern</span
								>
								<MathRenderer
									content={activeArchetype.structural_pattern}
									inline={true}
									class="text-text-primary"
								/>
							</div>
						{/if}
						{#if activeArchetype.why_it_is_tested_this_way}
							<div class="p-2.5 bg-surface border border-border-color sm:col-span-2">
								<span class="text-[10px] text-text-muted uppercase block font-bold mb-1"
									>Why Tested This Way</span
								>
								<MathRenderer
									content={activeArchetype.why_it_is_tested_this_way}
									inline={true}
									class="text-text-primary"
								/>
							</div>
						{/if}
					</div>

					{#if activeArchetype.deep_pattern || activeArchetype.surface_form}
						<div
							class="p-3 bg-indigo-500/10 border-2 border-indigo-500/40 space-y-1.5 font-mono text-xs"
						>
							{#if activeArchetype.surface_form}
								<div>
									<span class="text-[10px] text-text-muted uppercase font-bold mb-0.5 block"
										>Surface Form:</span
									>
									<MathRenderer
										content={activeArchetype.surface_form}
										inline={true}
										class="text-text-secondary"
									/>
								</div>
							{/if}
							{#if activeArchetype.deep_pattern}
								<div>
									<span
										class="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase mb-0.5 block"
										>Deep Underlying Pattern:</span
									>
									<MathRenderer
										content={activeArchetype.deep_pattern}
										inline={true}
										class="text-text-primary font-medium"
									/>
								</div>
							{/if}
						</div>
					{/if}

					{#if activeArchetype.generation_guidance}
						<div
							class="p-3 bg-emerald-500/10 border border-emerald-500/40 font-mono text-xs space-y-1"
						>
							<span
								class="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase mb-0.5 block"
								>Generation Guidance</span
							>
							<MathRenderer
								content={activeArchetype.generation_guidance}
								inline={true}
								class="text-text-primary leading-relaxed"
							/>
						</div>
					{/if}

					{#if activeArchetype.anti_imitation_notes}
						<div
							class="p-3 bg-rose-500/10 border border-rose-500/40 font-mono text-xs space-y-1"
						>
							<span
								class="text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase mb-0.5 block"
								>Anti-Imitation Notes</span
							>
							<MathRenderer
								content={activeArchetype.anti_imitation_notes}
								inline={true}
								class="text-text-primary leading-relaxed"
							/>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
