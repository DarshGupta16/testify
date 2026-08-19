<script lang="ts">
import MathRenderer from '$lib/components/common/MathRenderer.svelte';
import type { EnrichedReviewQuestion } from '$lib/services/assessmentEvaluator';
import { formatSecondsToText } from '$lib/utils';

const {
	item,
	onzoom,
}: {
	item: EnrichedReviewQuestion;
	onzoom: (item: { title: string; src: string; info?: string }) => void;
} = $props();

const q = $derived(item.q);
const resp = $derived(item.resp);

const correctOptionIds = $derived<string[]>(
	q.correctAnswers || (q.correctAnswer ? [q.correctAnswer] : [])
);

const userSelectedOptionIds = $derived<string[]>(
	resp?.selectedOptionIds || (resp?.selectedOptionId ? [resp.selectedOptionId] : [])
);
</script>

<div class="neo-box p-4 sm:p-6 bg-surface space-y-4">
	<!-- Question Review Header -->
	<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border-color/30 pb-3">
		<div class="flex flex-wrap items-center gap-2 font-mono text-xs">
			<span class="font-bold text-text-primary uppercase">
				Question #{item.originalIndex + 1}
			</span>

			{#if item.isCorrect}
				<span class="neo-badge bg-emerald-600 text-white border-emerald-700">
					✓ Correct
				</span>
			{:else if item.isPartiallyCorrect}
				<span class="neo-badge bg-amber-500 text-white border-amber-600">
					◐ Partially Correct
				</span>
			{:else if item.isIncorrect}
				<span class="neo-badge bg-rose-600 text-white border-rose-700">
					✕ Incorrect
				</span>
			{:else}
				<span class="neo-badge bg-muted text-text-muted">
					⊘ Unattempted
				</span>
			{/if}

			{#if item.isMarked}
				<span class="neo-badge bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40">
					★ Marked
				</span>
			{/if}
		</div>

		<div class="flex items-center gap-2 font-mono text-xs">
			{#if item.timeSpentSeconds > 0}
				<span class="text-text-muted bg-muted px-2 py-0.5 border border-border-color/30 text-[11px]">
					⏱️ {formatSecondsToText(item.timeSpentSeconds)}
				</span>
			{/if}

			<span class={`font-bold ${item.marksAwarded > 0 ? 'text-emerald-600 dark:text-emerald-400' : item.marksAwarded < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-text-muted'}`}>
				{item.marksAwarded > 0 ? `+${item.marksAwarded}` : item.marksAwarded} / {q.marks} Pts
			</span>
		</div>
	</div>

	<!-- Figure if present -->
	{#if q.associatedDiagramUrl}
		<div class="p-2.5 bg-muted/30 border-2 border-border-color inline-block max-w-full">
			<button
				type="button"
				onclick={() =>
					onzoom({
						title: `Question #${item.originalIndex + 1} - Figure`,
						src: q.associatedDiagramUrl!,
						info: `Linked figure ${q.associatedDiagramId || ''}`,
					})}
				class="cursor-pointer group flex flex-col items-start gap-1"
			>
				<img
					src={q.associatedDiagramUrl}
					alt="Figure for Question {item.originalIndex + 1}"
					class="max-h-48 max-w-full object-contain bg-white border border-border-color/30 group-hover:scale-[1.01] transition-transform"
					loading="lazy"
				/>
				<span class="font-mono text-[10px] text-accent-contrast underline">
					🔍 Click diagram to enlarge
				</span>
			</button>
		</div>
	{/if}

	<!-- Question Text -->
	<div class="text-sm font-medium text-text-primary leading-relaxed">
		<MathRenderer content={q.text} />
	</div>

	<!-- Options Review Display -->
	{#if q.options && q.options.length > 0}
		<div class="grid grid-cols-1 gap-2 pt-1 font-mono text-xs">
			{#each q.options as opt, optIdx}
				{@const isCorrectOpt = correctOptionIds.includes(opt.id)}
				{@const isUserSelected = userSelectedOptionIds.includes(opt.id)}

				<div
					class={`p-2.5 sm:p-3 border-2 flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3 ${
						isCorrectOpt && isUserSelected
							? 'bg-emerald-500/15 border-emerald-600 text-text-primary'
							: isCorrectOpt
								? 'bg-emerald-500/10 border-emerald-500/60 text-text-primary'
								: isUserSelected
									? 'bg-rose-500/15 border-rose-500 text-text-primary'
									: 'bg-muted/30 border-border-color/30 text-text-muted'
					}`}
				>
					<div class="flex items-start gap-2.5 flex-1">
						<span
							class={`flex h-5 w-5 shrink-0 items-center justify-center font-mono text-xs font-bold border ${
								isCorrectOpt
									? 'bg-emerald-600 text-white border-emerald-700'
									: isUserSelected
										? 'bg-rose-600 text-white border-rose-700'
										: 'bg-muted border-border-color/50 text-text-muted'
							}`}
						>
							{String.fromCharCode(65 + optIdx)}
						</span>
						<div class="pt-0.5 text-xs font-medium break-words">
							<MathRenderer content={opt.text} inline={true} />
						</div>
					</div>

					<div class="shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase self-end sm:self-auto">
						{#if isCorrectOpt && isUserSelected}
							<span class="text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 border border-emerald-500/50">
								✓ Correct Choice
							</span>
						{:else if isCorrectOpt}
							<span class="text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 border border-emerald-500/50">
								✓ Expected Answer
							</span>
						{:else if isUserSelected}
							<span class="text-rose-600 dark:text-rose-400 bg-rose-500/20 px-1.5 py-0.5 border border-rose-500/50">
								✕ Your Selection
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else if q.type === 'numerical'}
		<!-- Numerical comparison box -->
		<div class="p-3 bg-muted/40 border-2 border-border-color font-mono text-xs space-y-1">
			<div class="flex items-center gap-2">
				<span class="text-text-muted uppercase">Your Answer:</span>
				<span class="font-bold text-text-primary font-mono">{resp?.numericalAnswer || 'None (Unattempted)'}</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-emerald-600 dark:text-emerald-400 uppercase font-bold">Correct Expected:</span>
				<span class="font-bold text-emerald-700 dark:text-emerald-300 font-mono">
					<MathRenderer content={q.correctAnswer || '0.0'} inline={true} />
				</span>
			</div>
		</div>
	{/if}

	<!-- Hint & Explanation Section -->
	{#if q.explanation || q.hint}
		<div class="pt-3 border-t border-border-color/20 space-y-2 text-xs">
			{#if q.hint}
				<div class="p-2.5 bg-indigo-500/10 border border-indigo-500/30 space-y-0.5">
					<span class="font-mono font-bold text-indigo-700 dark:text-indigo-300 uppercase block text-[10px]">
						💡 Concept Hint:
					</span>
					<MathRenderer content={q.hint} />
				</div>
			{/if}

			{#if q.explanation}
				<div class="p-3.5 bg-emerald-500/10 border-2 border-emerald-500/30 space-y-1">
					<span class="font-mono font-bold text-emerald-700 dark:text-emerald-300 uppercase block text-[11px]">
						📖 Step-by-Step Derivation & Explanation:
					</span>
					<div class="text-text-primary leading-relaxed">
						<MathRenderer content={q.explanation} />
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
