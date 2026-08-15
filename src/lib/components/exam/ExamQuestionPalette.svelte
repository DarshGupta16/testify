<script lang="ts">
import { hasResponseAnswer } from '$lib/services/assessmentEvaluator';
import type { QuestionPreview, TestMode, UserQuestionResponse } from '$lib/types/test';

const {
	questions = [],
	currentIndex = 0,
	userResponses = {},
	paletteFilter = 'all',
	filteredIndices = [],
	mode = 'exam',
	onselectquestion,
	onsetpalettefilter,
	onopensubmit,
}: {
	questions: QuestionPreview[];
	currentIndex: number;
	userResponses: Record<string, UserQuestionResponse>;
	paletteFilter: 'all' | 'attempted' | 'unattempted' | 'marked';
	filteredIndices: number[];
	mode: TestMode;
	onselectquestion: (idx: number) => void;
	onsetpalettefilter: (filter: 'all' | 'attempted' | 'unattempted' | 'marked') => void;
	onopensubmit: () => void;
} = $props();

const filterCounts = $derived.by(() => {
	let attempted = 0;
	let marked = 0;

	for (const q of questions) {
		const resp = userResponses[q.id];
		if (hasResponseAnswer(resp)) attempted++;
		if (resp?.isMarkedForReview) marked++;
	}

	return {
		all: questions.length,
		attempted,
		unattempted: questions.length - attempted,
		marked,
	};
});
</script>

<div class="neo-box p-4 sm:p-5 bg-surface space-y-4 sticky top-20">
	<!-- Palette Header -->
	<div class="flex items-center justify-between border-b-2 border-border-color pb-2.5">
		<h3 class="font-sans text-xs sm:text-sm font-black uppercase tracking-tight text-text-primary">
			Question Palette
		</h3>
		<span class="font-mono text-[11px] font-bold text-text-muted">
			{filterCounts.attempted}/{questions.length} Solved
		</span>
	</div>

	<!-- Filter Tabs -->
	<div class="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
		<button
			type="button"
			onclick={() => onsetpalettefilter('all')}
			class={`p-1.5 border text-center font-bold transition-all ${
				paletteFilter === 'all'
					? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast'
					: 'bg-muted/40 border-border-color/40 text-text-secondary hover:bg-muted'
			}`}
		>
			All ({filterCounts.all})
		</button>
		<button
			type="button"
			onclick={() => onsetpalettefilter('attempted')}
			class={`p-1.5 border text-center font-bold transition-all ${
				paletteFilter === 'attempted'
					? 'bg-emerald-600 text-white border-emerald-700'
					: 'bg-muted/40 border-border-color/40 text-text-secondary hover:bg-muted'
			}`}
		>
			Solved ({filterCounts.attempted})
		</button>
		<button
			type="button"
			onclick={() => onsetpalettefilter('unattempted')}
			class={`p-1.5 border text-center font-bold transition-all ${
				paletteFilter === 'unattempted'
					? 'bg-rose-600 text-white border-rose-700'
					: 'bg-muted/40 border-border-color/40 text-text-secondary hover:bg-muted'
			}`}
		>
			Unsolved ({filterCounts.unattempted})
		</button>
		<button
			type="button"
			onclick={() => onsetpalettefilter('marked')}
			class={`p-1.5 border text-center font-bold transition-all ${
				paletteFilter === 'marked'
					? 'bg-amber-500 text-white border-amber-600'
					: 'bg-muted/40 border-border-color/40 text-text-secondary hover:bg-muted'
			}`}
		>
			Marked ({filterCounts.marked})
		</button>
	</div>

	<!-- Question Badges Grid -->
	<div class="grid grid-cols-5 gap-1.5 max-h-64 overflow-y-auto pr-1 py-1">
		{#each filteredIndices as qIdx}
			{@const q = questions[qIdx]}
			{@const resp = userResponses[q.id]}
			{@const hasAnswer = hasResponseAnswer(resp)}
			{@const isMarked = Boolean(resp?.isMarkedForReview)}
			{@const isCurrent = qIdx === currentIndex}
			{@const isVisited = Boolean(resp?.visited)}

			<button
				type="button"
				onclick={() => onselectquestion(qIdx)}
				class={`h-9 border-2 font-mono text-xs font-bold relative flex items-center justify-center transition-all cursor-pointer ${
					isCurrent
						? 'ring-2 ring-accent-contrast ring-offset-1 border-border-color'
						: 'border-border-color/70'
				} ${
					hasAnswer
						? isMarked
							? 'bg-amber-500 text-white border-amber-600'
							: 'bg-emerald-600 text-white border-emerald-700'
						: isMarked
							? 'bg-amber-500 text-white border-amber-600'
							: isVisited
								? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40'
								: 'bg-muted text-text-muted'
				}`}
				title={`Jump to Question ${qIdx + 1}`}
			>
				<span>{qIdx + 1}</span>
				{#if isMarked}
					<span class="absolute top-0.5 right-0.5 text-[8px] leading-none">★</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Status Legend -->
	<div class="grid grid-cols-2 gap-2 pt-2 border-t border-border-color/20 font-mono text-[10px] text-text-muted">
		<div class="flex items-center gap-1.5">
			<span class="h-3 w-3 bg-emerald-600 border border-emerald-700 inline-block"></span>
			<span>Answered</span>
		</div>
		<div class="flex items-center gap-1.5">
			<span class="h-3 w-3 bg-rose-500/20 border border-rose-500/50 inline-block"></span>
			<span>Not Answered</span>
		</div>
		<div class="flex items-center gap-1.5">
			<span class="h-3 w-3 bg-amber-500 border border-amber-600 inline-block"></span>
			<span>Marked Review</span>
		</div>
		<div class="flex items-center gap-1.5">
			<span class="h-3 w-3 bg-muted border border-border-color/50 inline-block"></span>
			<span>Not Visited</span>
		</div>
	</div>

	<!-- Submit CTA Button -->
	<div class="pt-2 border-t border-border-color/20">
		<button
			type="button"
			onclick={onopensubmit}
			class="neo-btn neo-btn-primary w-full text-xs py-2.5"
		>
			{mode === 'practice' ? 'End Practice Session' : 'Submit Examination'}
		</button>
	</div>
</div>
