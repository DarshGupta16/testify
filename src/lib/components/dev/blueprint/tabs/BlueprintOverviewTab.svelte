<script lang="ts">
import type { PaperBlueprint } from '$lib/types/blueprint';

let { blueprint }: { blueprint: PaperBlueprint } = $props();

function formatDistItem(item: string | Record<string, unknown>): string {
	if (typeof item === 'string') return item;
	return Object.entries(item)
		.map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
		.join(' - ');
}

const hasDistributionData = $derived(
	Boolean(
		blueprint.question_distribution &&
			(blueprint.question_distribution.conceptual_application_depth?.length ||
				blueprint.question_distribution.single_vs_multi_concept?.length ||
				blueprint.question_distribution.direct_vs_indirect_application?.length ||
				blueprint.question_distribution.qualitative_vs_quantitative_reasoning?.length ||
				blueprint.question_distribution.visual_data_usage?.length)
	)
);
</script>

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

	<!-- Target Student Profile -->
	{#if blueprint.paper_overview?.target_student_profile && (blueprint.paper_overview.target_student_profile.description || blueprint.paper_overview.target_student_profile.emphasized_abilities?.length || blueprint.paper_overview.target_student_profile.reasoning)}
		<div class="neo-box p-4 bg-surface border-2 border-border-color space-y-3">
			<span class="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted block">
				Target Student Profile
			</span>
			{#if blueprint.paper_overview.target_student_profile.description}
				<p class="text-sm text-text-primary leading-relaxed font-sans">
					{blueprint.paper_overview.target_student_profile.description}
				</p>
			{/if}
			{#if blueprint.paper_overview.target_student_profile.emphasized_abilities?.length}
				<div class="space-y-1.5">
					<span class="text-[10px] font-mono font-bold uppercase text-text-muted block">
						Emphasized Abilities:
					</span>
					<div class="flex flex-wrap gap-1.5">
						{#each blueprint.paper_overview.target_student_profile.emphasized_abilities as ability}
							<span
								class="neo-badge bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 font-mono text-[11px]"
							>
								<span class="text-indigo-600 dark:text-indigo-400 font-bold mr-0.5">✦</span>
								{ability}
							</span>
						{/each}
					</div>
				</div>
			{/if}
			{#if blueprint.paper_overview.target_student_profile.reasoning}
				<div class="text-xs font-mono text-text-secondary border-t border-border-color/30 pt-2">
					<span class="font-bold text-text-primary">Reasoning:</span>
					{blueprint.paper_overview.target_student_profile.reasoning}
				</div>
			{/if}
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
						<span class="text-indigo-600 dark:text-indigo-400 font-bold shrink-0">✦</span>
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
				{#if blueprint.what_is_tested.concept_distribution?.length}
					<div class="mt-2.5 pt-2 border-t border-border-color/30">
						<span class="text-[10px] text-text-muted uppercase block font-bold mb-1.5">
							Concept Distribution
						</span>
						<div class="flex flex-wrap gap-1.5">
							{#each blueprint.what_is_tested.concept_distribution as cd}
								<span class="neo-badge bg-muted/60 text-text-secondary font-mono text-[10px]">
									{typeof cd === 'string' ? cd : JSON.stringify(cd)}
								</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div class="neo-box p-4 bg-surface border-2 border-border-color space-y-2">
				<span class="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted">
					Evaluative Intentions (Why Tested This Way)
				</span>
				<ul class="space-y-1 font-mono text-xs text-text-secondary">
					{#each blueprint.why_it_is_tested_this_way?.strongly_inferred_intentions || [] as intent}
						<li class="flex items-start gap-1.5">
							<span class="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
							<span class="leading-relaxed">{intent}</span>
						</li>
					{/each}
					{#each blueprint.why_it_is_tested_this_way?.weakly_inferred_intentions || [] as intent}
						<li class="flex items-start gap-1.5">
							<span class="text-amber-600 dark:text-amber-400 font-bold">~</span>
							<span class="leading-relaxed">{intent}</span>
						</li>
					{/each}
					{#each blueprint.why_it_is_tested_this_way?.observations || [] as obs}
						<li class="flex items-start gap-1.5">
							<span class="text-indigo-600 dark:text-indigo-400 font-bold">✦</span>
							<span class="leading-relaxed">{obs}</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}

	<!-- Question Type Distributions -->
	{#if hasDistributionData && blueprint.question_distribution}
		<div class="neo-box p-4 bg-surface border-2 border-border-color space-y-3">
			<span class="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted block">
				Question Type Distributions
			</span>
			<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 font-mono text-xs">
				{#if blueprint.question_distribution.conceptual_application_depth?.length}
					<div class="p-2.5 bg-muted/20 border border-border-color space-y-1">
						<span class="text-[10px] text-text-muted uppercase font-bold block">
							Conceptual Depth
						</span>
						<ul class="space-y-0.5 text-text-primary text-[11px]">
							{#each blueprint.question_distribution.conceptual_application_depth as item}
								<li>• {formatDistItem(item)}</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if blueprint.question_distribution.single_vs_multi_concept?.length}
					<div class="p-2.5 bg-muted/20 border border-border-color space-y-1">
						<span class="text-[10px] text-text-muted uppercase font-bold block">
							Concept Breadth
						</span>
						<ul class="space-y-0.5 text-text-primary text-[11px]">
							{#each blueprint.question_distribution.single_vs_multi_concept as item}
								<li>• {formatDistItem(item)}</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if blueprint.question_distribution.direct_vs_indirect_application?.length}
					<div class="p-2.5 bg-muted/20 border border-border-color space-y-1">
						<span class="text-[10px] text-text-muted uppercase font-bold block">
							Application Directness
						</span>
						<ul class="space-y-0.5 text-text-primary text-[11px]">
							{#each blueprint.question_distribution.direct_vs_indirect_application as item}
								<li>• {formatDistItem(item)}</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if blueprint.question_distribution.qualitative_vs_quantitative_reasoning?.length}
					<div class="p-2.5 bg-muted/20 border border-border-color space-y-1">
						<span class="text-[10px] text-text-muted uppercase font-bold block">
							Reasoning Type
						</span>
						<ul class="space-y-0.5 text-text-primary text-[11px]">
							{#each blueprint.question_distribution.qualitative_vs_quantitative_reasoning as item}
								<li>• {formatDistItem(item)}</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if blueprint.question_distribution.visual_data_usage?.length}
					<div class="p-2.5 bg-muted/20 border border-border-color space-y-1">
						<span class="text-[10px] text-text-muted uppercase font-bold block">
							Visual & Data Usage
						</span>
						<ul class="space-y-0.5 text-text-primary text-[11px]">
							{#each blueprint.question_distribution.visual_data_usage as item}
								<li>• {formatDistItem(item)}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Distinctive Generation Rules & Anti-Imitation -->
	{#if blueprint.distinctive_generation_rules?.length || blueprint.anti_imitation_constraints?.length}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
			{#if blueprint.distinctive_generation_rules?.length}
				<div class="neo-box p-4 bg-emerald-500/10 border-2 border-emerald-500/50 space-y-2">
					<span
						class="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300"
					>
						Distinctive Generation Rules
					</span>
					<ul class="space-y-1 font-mono text-xs text-text-primary">
						{#each blueprint.distinctive_generation_rules as rule}
							<li class="flex items-start gap-1.5">
								<span class="font-bold text-emerald-600 dark:text-emerald-400">→</span>
								<span class="leading-relaxed">{rule}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if blueprint.anti_imitation_constraints?.length}
				<div class="neo-box p-4 bg-rose-500/10 border-2 border-rose-500/50 space-y-2">
					<span
						class="font-mono text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300"
					>
						Anti-Imitation Constraints (Must Avoid)
					</span>
					<ul class="space-y-1 font-mono text-xs text-text-primary">
						{#each blueprint.anti_imitation_constraints as c}
							<li class="flex items-start gap-1.5">
								<span class="font-bold text-rose-600 dark:text-rose-400">✕</span>
								<span class="leading-relaxed">{c}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</div>
