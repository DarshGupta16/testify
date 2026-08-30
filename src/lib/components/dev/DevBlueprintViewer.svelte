<script lang="ts">
import type { PaperBlueprint } from '$lib/types/blueprint';

let { blueprint, testTitle }: { blueprint: PaperBlueprint; testTitle?: string } = $props();

type BlueprintSection = 'overview' | 'archetypes' | 'style' | 'patterns' | 'raw';
let activeSection = $state<BlueprintSection>('overview');
let isCopied = $state(false);
let selectedArchetypeIndex = $state<number>(0);

function copyBlueprintJson() {
	try {
		navigator.clipboard.writeText(JSON.stringify(blueprint, null, 2));
		isCopied = true;
		setTimeout(() => (isCopied = false), 2000);
	} catch (err) {
		console.error('Failed to copy blueprint JSON:', err);
	}
}

const archetypes = $derived(blueprint.question_archetypes || []);
const activeArchetype = $derived(archetypes[selectedArchetypeIndex] || archetypes[0]);
</script>

<div class="flex flex-col h-full bg-surface font-sans text-text-primary">
	<!-- Blueprint Header -->
	<div class="border-b-2 border-border-color bg-muted/40 p-3 sm:p-4 shrink-0">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
			<div class="space-y-1 min-w-0">
				<div class="flex items-center gap-2 flex-wrap">
					<span class="neo-badge bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-xs uppercase">
						📐 Phase 1 Paper Blueprint
					</span>
					{#if blueprint.question_distribution?.total_questions}
						<span class="neo-badge bg-accent-contrast text-accent-contrast-text font-mono font-bold text-xs uppercase">
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
				>
					{isCopied ? '✓ Copied JSON' : '📋 Copy Blueprint JSON'}
				</button>
			</div>
		</div>
	</div>

	<!-- Section Stepper Navigation -->
	<div class="border-b-2 border-border-color bg-surface px-3 pt-2 shrink-0 overflow-x-auto no-scrollbar whitespace-nowrap flex items-center gap-1.5 font-mono text-xs font-bold">
		<button
			type="button"
			onclick={() => (activeSection = 'overview')}
			class={`neo-btn text-xs py-2 px-3 border-b-0 shrink-0 cursor-pointer ${activeSection === 'overview' ? 'neo-btn-primary' : 'bg-surface hover:bg-muted'}`}
		>
			1. Overview & Philosophy
		</button>
		<button
			type="button"
			onclick={() => (activeSection = 'archetypes')}
			class={`neo-btn text-xs py-2 px-3 border-b-0 shrink-0 cursor-pointer ${activeSection === 'archetypes' ? 'neo-btn-primary' : 'bg-surface hover:bg-muted'}`}
		>
			2. Question Archetypes ({archetypes.length})
		</button>
		<button
			type="button"
			onclick={() => (activeSection = 'style')}
			class={`neo-btn text-xs py-2 px-3 border-b-0 shrink-0 cursor-pointer ${activeSection === 'style' ? 'neo-btn-primary' : 'bg-surface hover:bg-muted'}`}
		>
			3. Writing Style & Distractors
		</button>
		<button
			type="button"
			onclick={() => (activeSection = 'patterns')}
			class={`neo-btn text-xs py-2 px-3 border-b-0 shrink-0 cursor-pointer ${activeSection === 'patterns' ? 'neo-btn-primary' : 'bg-surface hover:bg-muted'}`}
		>
			4. Surface vs Deep Patterns ({blueprint.surface_vs_deep_patterns?.length || 0})
		</button>
		<button
			type="button"
			onclick={() => (activeSection = 'raw')}
			class={`neo-btn text-xs py-2 px-3 border-b-0 shrink-0 cursor-pointer ${activeSection === 'raw' ? 'neo-btn-primary' : 'bg-surface hover:bg-muted'}`}
		>
			5. Raw JSON
		</button>
	</div>

	<!-- Section Body Content -->
	<div class="flex-1 overflow-y-auto p-3 sm:p-5">
		{#if activeSection === 'overview'}
			<div class="space-y-4 max-w-4xl">
				<!-- Overall Philosophy Card -->
				{#if blueprint.paper_overview?.overall_design_philosophy}
					<div class="neo-box p-4 bg-muted/20 border-2 border-border-color space-y-2">
						<span class="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted">
							Overall Design Philosophy
						</span>
						<p class="text-sm text-text-primary leading-relaxed font-sans font-medium">
							{blueprint.paper_overview.overall_design_philosophy}
						</p>
					</div>
				{/if}

				<!-- Distinctive Characteristics -->
				{#if blueprint.paper_overview?.distinctive_characteristics?.length}
					<div class="neo-box p-4 bg-surface border-2 border-border-color space-y-2.5">
						<span class="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted">
							Distinctive Characteristics
						</span>
						<ul class="space-y-1.5 font-mono text-xs">
							{#each blueprint.paper_overview.distinctive_characteristics as char}
								<li class="flex items-start gap-2">
									<span class="text-indigo-600 font-bold shrink-0">✦</span>
									<span class="text-text-primary leading-relaxed">{char}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<!-- What Is Tested Grid -->
				{#if blueprint.what_is_tested}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						<div class="neo-box p-4 bg-surface border-2 border-border-color space-y-2">
							<span class="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted">
								Subjects & Topics Covered
							</span>
							<div class="flex flex-wrap gap-1.5">
								{#each blueprint.what_is_tested.subjects || [] as sub}
									<span class="neo-badge bg-primary/20 text-primary-text font-mono text-[11px]">
										{sub}
									</span>
								{/each}
								{#each blueprint.what_is_tested.topics || [] as top}
									<span class="neo-badge bg-muted text-text-primary font-mono text-[11px]">
										{typeof top === 'string' ? top : JSON.stringify(top)}
									</span>
								{/each}
							</div>
						</div>

						<div class="neo-box p-4 bg-surface border-2 border-border-color space-y-2">
							<span class="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted">
								Evaluative Intentions (Why Tested This Way)
							</span>
							<ul class="space-y-1 font-mono text-xs text-text-secondary">
								{#each blueprint.why_it_is_tested_this_way?.strongly_inferred_intentions || [] as intent}
									<li class="flex items-start gap-1.5">
										<span class="text-emerald-600 font-bold">✓</span>
										<span class="leading-relaxed">{intent}</span>
									</li>
								{/each}
								{#each blueprint.why_it_is_tested_this_way?.weakly_inferred_intentions || [] as intent}
									<li class="flex items-start gap-1.5">
										<span class="text-amber-600 font-bold">~</span>
										<span class="leading-relaxed">{intent}</span>
									</li>
								{/each}
							</ul>
						</div>
					</div>
				{/if}

				<!-- Distinctive Generation Rules & Anti-Imitation -->
				{#if blueprint.distinctive_generation_rules?.length || blueprint.anti_imitation_constraints?.length}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						{#if blueprint.distinctive_generation_rules?.length}
							<div class="neo-box p-4 bg-emerald-500/10 border-2 border-emerald-500/50 space-y-2">
								<span class="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
									Distinctive Generation Rules
								</span>
								<ul class="space-y-1 font-mono text-xs text-text-primary">
									{#each blueprint.distinctive_generation_rules as rule}
										<li class="flex items-start gap-1.5">
											<span class="font-bold text-emerald-600">→</span>
											<span class="leading-relaxed">{rule}</span>
										</li>
									{/each}
								</ul>
							</div>
						{/if}

						{#if blueprint.anti_imitation_constraints?.length}
							<div class="neo-box p-4 bg-rose-500/10 border-2 border-rose-500/50 space-y-2">
								<span class="font-mono text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
									Anti-Imitation Constraints (Must Avoid)
								</span>
								<ul class="space-y-1 font-mono text-xs text-text-primary">
									{#each blueprint.anti_imitation_constraints as c}
										<li class="flex items-start gap-1.5">
											<span class="font-bold text-rose-600">✕</span>
											<span class="leading-relaxed">{c}</span>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{:else if activeSection === 'archetypes'}
			{#if archetypes.length === 0}
				<div class="p-8 text-center font-mono text-xs text-text-muted border-2 border-dashed border-border-color">
					No question archetypes recorded in this blueprint.
				</div>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<!-- Archetype Selector List -->
					<div class="space-y-1.5 md:border-r-2 md:border-border-color pr-2">
						<span class="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted block mb-2">
							Archetypes ({archetypes.length})
						</span>
						{#each archetypes as arch, idx}
							<button
								type="button"
								onclick={() => (selectedArchetypeIndex = idx)}
								class={`w-full text-left p-2.5 neo-box text-xs font-mono transition-all cursor-pointer ${
									selectedArchetypeIndex === idx
										? 'bg-accent-contrast text-accent-contrast-text border-2 font-bold shadow-[2px_2px_0px_var(--shadow-color)]'
										: 'bg-surface hover:bg-muted/60 text-text-primary'
								}`}
							>
								<div class="flex items-center justify-between gap-1 mb-1">
									<span class="font-bold truncate">{arch.name || `Archetype ${idx + 1}`}</span>
									{#if arch.count || arch.percentage}
										<span class="text-[10px] opacity-80 shrink-0">
											{arch.count ? `${arch.count} Qs` : ''} {arch.percentage ? `(${arch.percentage}%)` : ''}
										</span>
									{/if}
								</div>
								{#if arch.description}
									<p class="text-[10px] opacity-75 line-clamp-2 leading-snug">
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
											<p class="text-xs text-text-secondary mt-0.5">
												{activeArchetype.description}
											</p>
										{/if}
									</div>
									{#if activeArchetype.representative_question_ids?.length}
										<div class="text-right font-mono text-[10px] text-text-muted shrink-0">
											<span>Ref IDs:</span>
											<span class="font-bold text-text-primary">{activeArchetype.representative_question_ids.join(', ')}</span>
										</div>
									{/if}
								</div>

								<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-xs">
									{#if activeArchetype.what_is_tested}
										<div class="p-2.5 bg-surface border border-border-color">
											<span class="text-[10px] text-text-muted uppercase block font-bold">What Is Tested</span>
											<span class="text-text-primary">{activeArchetype.what_is_tested}</span>
										</div>
									{/if}
									{#if activeArchetype.how_it_is_tested}
										<div class="p-2.5 bg-surface border border-border-color">
											<span class="text-[10px] text-text-muted uppercase block font-bold">How It Is Tested</span>
											<span class="text-text-primary">{activeArchetype.how_it_is_tested}</span>
										</div>
									{/if}
									{#if activeArchetype.reasoning_pattern}
										<div class="p-2.5 bg-surface border border-border-color">
											<span class="text-[10px] text-text-muted uppercase block font-bold">Reasoning Pattern</span>
											<span class="text-text-primary">{activeArchetype.reasoning_pattern}</span>
										</div>
									{/if}
									{#if activeArchetype.conceptual_application_depth}
										<div class="p-2.5 bg-surface border border-border-color">
											<span class="text-[10px] text-text-muted uppercase block font-bold">Conceptual Depth</span>
											<span class="text-text-primary">{activeArchetype.conceptual_application_depth}</span>
										</div>
									{/if}
								</div>

								{#if activeArchetype.deep_pattern || activeArchetype.surface_form}
									<div class="p-3 bg-indigo-500/10 border-2 border-indigo-500/40 space-y-1.5 font-mono text-xs">
										{#if activeArchetype.surface_form}
											<div>
												<span class="text-[10px] text-text-muted uppercase font-bold">Surface Form:</span>
												<p class="text-text-secondary">{activeArchetype.surface_form}</p>
											</div>
										{/if}
										{#if activeArchetype.deep_pattern}
											<div>
												<span class="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Deep Underlying Pattern:</span>
												<p class="text-text-primary font-medium">{activeArchetype.deep_pattern}</p>
											</div>
										{/if}
									</div>
								{/if}

								{#if activeArchetype.generation_guidance}
									<div class="p-3 bg-emerald-500/10 border border-emerald-500/40 font-mono text-xs space-y-1">
										<span class="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Generation Guidance</span>
										<p class="text-text-primary leading-relaxed">{activeArchetype.generation_guidance}</p>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		{:else if activeSection === 'style'}
			<div class="space-y-4 max-w-4xl font-mono text-xs">
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
					</div>
				{/if}

				{#if blueprint.distractor_patterns?.length}
					<div class="neo-box p-4 bg-muted/20 border-2 border-border-color space-y-2">
						<span class="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
							Distractor Construction Patterns
						</span>
						<ul class="space-y-1.5">
							{#each blueprint.distractor_patterns as dist}
								<li class="flex items-start gap-2">
									<span class="text-indigo-600 font-bold">✦</span>
									<span class="text-text-primary leading-relaxed">
										{typeof dist === 'string' ? dist : JSON.stringify(dist)}
									</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

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
										<span class="text-emerald-600 font-bold">→</span>
										<span class="text-text-secondary">{ord}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			</div>
		{:else if activeSection === 'patterns'}
			{#if !blueprint.surface_vs_deep_patterns || blueprint.surface_vs_deep_patterns.length === 0}
				<div class="p-8 text-center font-mono text-xs text-text-muted border-2 border-dashed border-border-color">
					No surface vs deep pattern mappings recorded.
				</div>
			{:else}
				<div class="space-y-3 max-w-4xl font-mono text-xs">
					{#each blueprint.surface_vs_deep_patterns as pat, idx}
						<div class="neo-box p-4 bg-surface border-2 border-border-color space-y-2.5">
							<div class="flex items-center justify-between border-b border-border-color/30 pb-1.5">
								<span class="font-bold uppercase text-text-primary">Pattern #{idx + 1}</span>
							</div>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
								<div class="p-2.5 bg-rose-500/10 border border-rose-500/30">
									<span class="text-[10px] text-rose-800 dark:text-rose-300 uppercase font-bold block mb-1">
										Surface Observation (Do Not Copy Literally)
									</span>
									<p class="text-text-secondary">{pat.surface_pattern}</p>
								</div>
								<div class="p-2.5 bg-emerald-500/10 border border-emerald-500/30">
									<span class="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase font-bold block mb-1">
										Deep Underlying Structure (Preserve This)
									</span>
									<p class="text-text-primary font-bold">{pat.deep_pattern}</p>
								</div>
							</div>
							{#if pat.generation_instruction}
								<div class="p-2 bg-muted/40 border border-border-color">
									<span class="text-[10px] text-text-muted uppercase font-bold block">
										Generation Directive
									</span>
									<p class="text-text-primary">{pat.generation_instruction}</p>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{:else if activeSection === 'raw'}
			<div class="relative neo-box p-3 bg-muted/30 border-2 border-border-color">
				<pre class="font-mono text-xs text-text-primary overflow-x-auto p-2 leading-relaxed max-h-[500px]">
{JSON.stringify(blueprint, null, 2)}
				</pre>
			</div>
		{/if}
	</div>
</div>
