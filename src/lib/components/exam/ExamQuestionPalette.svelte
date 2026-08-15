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

const examMetrics = $derived.by(() => {
	let answered = 0;
	let marked = 0;

	for (const q of questions) {
		const resp = userResponses[q.id];
		if (hasResponseAnswer(resp)) answered++;
		if (resp?.isMarkedForReview) marked++;
	}

	return {
		answered,
		unanswered: questions.length - answered,
		marked,
		total: questions.length,
	};
});
</script>

<div class="neo-box p-5 bg-surface space-y-4">
	<!-- At-A-Glance Status Filter Pills -->
	<div class="space-y-2 border-b-2 border-border-color/20 pb-3">
		<span class="font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted block">
			At-A-Glance Question Status
		</span>
		<div class="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
			<button
				type="button"
				onclick={() => onsetpalettefilter('all')}
				class={`p-2 border text-left transition-colors flex items-center justify-between cursor-pointer ${
					paletteFilter === 'all'
						? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast font-bold'
						: 'bg-surface hover:bg-muted text-text-secondary border-border-color/40'
				}`}
			>
				<span>All Qs</span>
				<span class="font-bold">{questions.length}</span>
			</button>

			<button
				type="button"
				onclick={() => onsetpalettefilter('attempted')}
				class={`p-2 border text-left transition-colors flex items-center justify-between cursor-pointer ${
					paletteFilter === 'attempted'
						? 'bg-emerald-600 text-white border-emerald-800 font-bold'
						: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
				}`}
			>
				<span>Attempted</span>
				<span class="font-bold">{examMetrics.answered}</span>
			</button>

			<button
				type="button"
				onclick={() => onsetpalettefilter('unattempted')}
				class={`p-2 border text-left transition-colors flex items-center justify-between cursor-pointer ${
					paletteFilter === 'unattempted'
						? 'bg-rose-600 text-white border-rose-800 font-bold'
						: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
				}`}
			>
				<span>Unattempted</span>
				<span class="font-bold">{examMetrics.unanswered}</span>
			</button>

			<button
				type="button"
				onclick={() => onsetpalettefilter('marked')}
				class={`p-2 border text-left transition-colors flex items-center justify-between cursor-pointer ${
					paletteFilter === 'marked'
						? 'bg-purple-600 text-white border-purple-800 font-bold'
						: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
				}`}
			>
				<span>Marked</span>
				<span class="font-bold">{examMetrics.marked}</span>
			</button>
		</div>
	</div>

	<!-- Palette Grid -->
	<div class="space-y-2">
		<div class="flex items-center justify-between font-mono text-[10px] text-text-muted">
			<span>Jump to Question</span>
			<span>Showing {filteredIndices.length} of {questions.length}</span>
		</div>

		<div class="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
			{#each questions as q, idx}
				{@const isVisible = filteredIndices.includes(idx)}
				{@const resp = userResponses[q.id]}
				{@const hasAnswer = hasResponseAnswer(resp)}
				{@const isMarked = resp?.isMarkedForReview}
				{@const isCurrent = idx === currentIndex}
				{@const isVisited = resp?.visited}

				{@const badgeColorClass = hasAnswer && isMarked
					? 'bg-indigo-600 text-white border-indigo-800'
					: isMarked
						? 'bg-purple-600 text-white border-purple-800'
						: hasAnswer
							? 'bg-emerald-600 text-white border-emerald-800'
							: isVisited
								? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500'
								: 'bg-surface text-text-muted border-border-color/60'}

				{#if isVisible}
					<button
						type="button"
						onclick={() => onselectquestion(idx)}
						class={`h-9 text-xs font-mono font-bold border-2 flex items-center justify-center transition-all cursor-pointer ${badgeColorClass} ${
							isCurrent ? 'ring-2 ring-accent-contrast ring-offset-2 scale-105 shadow-sm' : 'hover:scale-102'
						}`}
						title={`Question ${idx + 1} (${hasAnswer ? 'Attempted' : 'Unattempted'})`}
					>
						{idx + 1}
					</button>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Palette Submit Button -->
	<button
		type="button"
		onclick={onopensubmit}
		class="neo-btn neo-btn-primary w-full text-xs py-2.5 mt-2"
	>
		{mode === 'practice' ? 'Complete Practice Session' : 'Final Exam Submission'}
	</button>
</div>
