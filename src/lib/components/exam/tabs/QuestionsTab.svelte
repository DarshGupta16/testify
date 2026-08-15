<script lang="ts">
import MathRenderer from '$lib/components/common/MathRenderer.svelte';
import type { QuestionPreview } from '$lib/types/test';

const {
	questions = [],
	onzoom,
}: {
	questions: QuestionPreview[];
	onzoom: (item: { title: string; src: string; info?: string }) => void;
} = $props();
</script>

<div class="space-y-4">
	{#if questions.length === 0}
		<div class="neo-box p-8 text-center bg-surface">
			<p class="font-mono text-xs text-text-muted uppercase">No questions extracted for this assessment.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each questions as q}
				<div class="neo-box p-4 sm:p-5 bg-surface text-sm space-y-3">
					<!-- Header Bar -->
					<div class="flex flex-wrap items-center justify-between gap-2 font-mono text-xs border-b border-border-color/20 pb-2.5">
						<div class="flex items-center gap-2">
							<span class="font-bold text-text-primary uppercase">Question #{q.questionNumber}</span>
							<span class="text-[10px] text-text-muted">
								{#if q.type === 'multi_choice' || q.type === 'multiple_choice_multi'}
									[Multi-Choice (Multi-Correct)]
								{:else if q.type === 'single_choice' || q.type === 'multiple_choice'}
									[Single Choice]
								{:else}
									[Numerical]
								{/if}
							</span>
						</div>
						<div class="flex items-center gap-2">
							<span class="neo-badge bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
								+{q.marks} Marks
							</span>
							{#if q.negativeMarks && q.negativeMarks > 0}
								<span class="neo-badge bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px]">
									-{q.negativeMarks} Neg
								</span>
							{/if}
						</div>
					</div>

					<!-- Question Diagram -->
					{#if q.associatedDiagramUrl}
						<div class="p-2.5 bg-muted/30 border-2 border-border-color inline-block max-w-full">
							<button
								type="button"
								onclick={() =>
									onzoom({
										title: `Question #${q.questionNumber} - Figure`,
										src: q.associatedDiagramUrl!,
										info: `Linked figure ${q.associatedDiagramId || ''}`,
									})}
								class="cursor-pointer group flex flex-col items-start gap-1"
							>
								<img
									src={q.associatedDiagramUrl}
									alt="Figure for Question {q.questionNumber}"
									class="max-h-48 max-w-full object-contain bg-white border border-border-color/30 group-hover:scale-[1.01] transition-transform"
									loading="lazy"
								/>
								<span class="font-mono text-[10px] text-accent-contrast underline">
									🔍 Click to enlarge figure
								</span>
							</button>
						</div>
					{/if}

					<!-- Question Statement -->
					<div class="text-sm font-medium text-text-primary leading-relaxed">
						<MathRenderer content={q.text} />
					</div>

					<!-- Options list if multiple choice -->
					{#if q.options && q.options.length > 0}
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-xs">
							{#each q.options as opt, optIdx}
								<div class="p-2 bg-muted/40 border border-border-color/40 flex items-start gap-2">
									<span class="font-bold text-text-secondary shrink-0">
										{String.fromCharCode(65 + optIdx)}.
									</span>
									<span class="text-text-primary break-words">
										<MathRenderer content={opt.text} inline={true} />
									</span>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Hint Preview -->
					{#if q.hint}
						<div class="p-2.5 bg-indigo-500/10 border border-indigo-500/30 text-xs">
							<span class="font-mono font-bold text-indigo-700 dark:text-indigo-300 block mb-0.5 text-[11px] uppercase">
								💡 Practice Hint:
							</span>
							<MathRenderer content={q.hint} />
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
