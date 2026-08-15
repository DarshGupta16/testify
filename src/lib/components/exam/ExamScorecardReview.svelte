<script lang="ts">
import ImageLightboxModal from '$lib/components/common/ImageLightboxModal.svelte';
import {
	calculateAttemptTimingStats,
	type EnrichedReviewQuestion,
	getEnrichedReviewQuestions,
} from '$lib/services/assessmentEvaluator';
import type { TestAttempt, TestItem } from '$lib/types/test';
import { formatDate, formatSecondsToText } from '$lib/utils';
import ReviewQuestionCard from './ReviewQuestionCard.svelte';

const {
	test,
	attempt,
	onexitreview,
	onretakepractice,
	onretakeexam,
}: {
	test: TestItem;
	attempt: TestAttempt;
	onexitreview: () => void;
	onretakepractice: () => void;
	onretakeexam: () => void;
} = $props();

const testQuestions = $derived(test.questions || []);

// Lightbox state
let zoomedImage = $state<{ title: string; src: string; info?: string } | null>(null);

// Timing Analytics
const timingStats = $derived.by(() => calculateAttemptTimingStats(testQuestions, attempt));

// Filter & Sort State
let reviewStatusFilter = $state<
	'all' | 'correct' | 'partial' | 'incorrect' | 'unattempted' | 'marked'
>('all');
let reviewTypeFilter = $state<'all' | 'single_choice' | 'multi_choice' | 'numerical'>('all');
let reviewSortBy = $state<
	'question_asc' | 'question_desc' | 'time_desc' | 'time_asc' | 'marks_desc' | 'marks_asc'
>('question_asc');
let reviewSearchQuery = $state<string>('');

// Enriched Question Catalog
const enrichedQuestions = $derived.by<EnrichedReviewQuestion[]>(() =>
	getEnrichedReviewQuestions(testQuestions, attempt)
);

// Filter Counts
const filterCounts = $derived.by(() => {
	let correct = 0;
	let partial = 0;
	let incorrect = 0;
	let unattempted = 0;
	let marked = 0;

	for (const item of enrichedQuestions) {
		if (item.isCorrect) correct++;
		if (item.isPartiallyCorrect) partial++;
		if (item.isIncorrect) incorrect++;
		if (item.isUnattempted) unattempted++;
		if (item.isMarked) marked++;
	}

	return {
		total: enrichedQuestions.length,
		correct,
		partial,
		incorrect,
		unattempted,
		marked,
	};
});

const hasActiveFilters = $derived(
	reviewStatusFilter !== 'all' ||
		reviewTypeFilter !== 'all' ||
		reviewSortBy !== 'question_asc' ||
		reviewSearchQuery.trim().length > 0
);

// Filtered & Sorted Display List
const displayedQuestions = $derived.by(() => {
	let list = [...enrichedQuestions];

	// Status Filter
	if (reviewStatusFilter === 'correct') {
		list = list.filter((item) => item.isCorrect);
	} else if (reviewStatusFilter === 'partial') {
		list = list.filter((item) => item.isPartiallyCorrect);
	} else if (reviewStatusFilter === 'incorrect') {
		list = list.filter((item) => item.isIncorrect);
	} else if (reviewStatusFilter === 'unattempted') {
		list = list.filter((item) => item.isUnattempted);
	} else if (reviewStatusFilter === 'marked') {
		list = list.filter((item) => item.isMarked);
	}

	// Type Filter
	if (reviewTypeFilter === 'single_choice') {
		list = list.filter(
			(item) => item.q.type === 'single_choice' || item.q.type === 'multiple_choice'
		);
	} else if (reviewTypeFilter === 'multi_choice') {
		list = list.filter(
			(item) => item.q.type === 'multi_choice' || item.q.type === 'multiple_choice_multi'
		);
	} else if (reviewTypeFilter === 'numerical') {
		list = list.filter((item) => item.q.type === 'numerical');
	}

	// Search Filter
	if (reviewSearchQuery.trim()) {
		const query = reviewSearchQuery.toLowerCase().trim();
		list = list.filter((item) => {
			const textMatch = item.q.text.toLowerCase().includes(query);
			const numMatch =
				`question ${item.originalIndex + 1}`.includes(query) ||
				`q${item.originalIndex + 1}`.includes(query) ||
				`#${item.originalIndex + 1}`.includes(query);
			const explMatch = item.q.explanation?.toLowerCase().includes(query);
			const optMatch = item.q.options?.some((o) =>
				(typeof o === 'string' ? o : o.text).toLowerCase().includes(query)
			);
			return textMatch || numMatch || explMatch || optMatch;
		});
	}

	// Sorting
	list.sort((a, b) => {
		switch (reviewSortBy) {
			case 'question_desc':
				return b.originalIndex - a.originalIndex;
			case 'time_desc':
				return b.timeSpentSeconds - a.timeSpentSeconds;
			case 'time_asc':
				return a.timeSpentSeconds - b.timeSpentSeconds;
			case 'marks_desc':
				return b.marksAwarded - a.marksAwarded;
			case 'marks_asc':
				return a.marksAwarded - b.marksAwarded;
			default:
				return a.originalIndex - b.originalIndex;
		}
	});

	return list;
});

function resetFilters() {
	reviewStatusFilter = 'all';
	reviewTypeFilter = 'all';
	reviewSortBy = 'question_asc';
	reviewSearchQuery = '';
}
</script>

<div class="space-y-8 animate-fade-in pb-12">
	<!-- Scorecard Hero Card -->
	<div class="neo-box-lg p-6 sm:p-8 bg-surface space-y-6">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-border-color pb-5">
			<div>
				<div class="flex items-center gap-2 mb-1.5 font-mono text-xs">
					<span class="neo-badge bg-accent-contrast text-accent-contrast-text">
						{attempt.mode === 'practice' ? '🌿 Practice Review' : '🎯 Exam Scorecard'}
					</span>
					<span class="text-text-muted">
						{formatDate(attempt.completedAt || attempt.startedAt)}
					</span>
				</div>
				<h2 class="text-xl sm:text-3xl font-black uppercase tracking-tight text-text-primary">
					{attempt.testTitle}
				</h2>
			</div>

			<!-- Exit & Retake Actions -->
			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onclick={onexitreview}
					class="neo-btn text-xs py-2 px-3.5"
				>
					&larr; Return to Test Hub
				</button>
				<button
					type="button"
					onclick={onretakepractice}
					class="neo-btn text-xs py-2 px-3.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
				>
					Retake Practice
				</button>
				<button
					type="button"
					onclick={onretakeexam}
					class="neo-btn neo-btn-primary text-xs py-2 px-4"
				>
					Retake Exam
				</button>
			</div>
		</div>

		<!-- High-Level Score Stats Grid -->
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
			<div class="border-2 border-border-color bg-muted/40 p-4">
				<span class="text-[11px] text-text-muted uppercase font-bold block">Final Score</span>
				<div class="flex items-baseline gap-1 mt-1">
					<span class="text-2xl sm:text-4xl font-black text-text-primary">{attempt.score}</span>
					<span class="text-xs text-text-muted">/ {attempt.maxPossibleScore}</span>
				</div>
			</div>

			<div class="border-2 border-border-color bg-muted/40 p-4">
				<span class="text-[11px] text-text-muted uppercase font-bold block">Percentage</span>
				<div class="flex items-baseline gap-1 mt-1">
					<span class="text-2xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400">
						{attempt.maxPossibleScore > 0 ? Math.round((Math.max(0, attempt.score) / attempt.maxPossibleScore) * 100) : 0}%
					</span>
				</div>
			</div>

			<div class="border-2 border-border-color bg-muted/40 p-4">
				<span class="text-[11px] text-text-muted uppercase font-bold block">Accuracy</span>
				<div class="flex items-baseline gap-1 mt-1">
					<span class="text-2xl sm:text-4xl font-black text-text-primary">{attempt.accuracyPercentage}%</span>
					<span class="text-[11px] text-text-muted font-bold">({attempt.correctCount}/{attempt.answeredCount})</span>
				</div>
			</div>

			<div class="border-2 border-border-color bg-muted/40 p-4">
				<span class="text-[11px] text-text-muted uppercase font-bold block">Time Taken</span>
				<div class="flex items-baseline gap-1 mt-1">
					<span class="text-xl sm:text-3xl font-black text-text-primary">
						{formatSecondsToText(attempt.durationSecondsTaken)}
					</span>
				</div>
			</div>
		</div>

		<!-- Question Result Breakdown Row -->
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
			<div class="p-3 border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-between">
				<span class="font-bold text-emerald-700 dark:text-emerald-300 uppercase">Correct:</span>
				<span class="font-black text-base text-emerald-700 dark:text-emerald-300">{filterCounts.correct}</span>
			</div>

			<div class="p-3 border border-amber-500/40 bg-amber-500/10 flex items-center justify-between">
				<span class="font-bold text-amber-700 dark:text-amber-300 uppercase">Partial:</span>
				<span class="font-black text-base text-amber-700 dark:text-amber-300">{filterCounts.partial}</span>
			</div>

			<div class="p-3 border border-rose-500/40 bg-rose-500/10 flex items-center justify-between">
				<span class="font-bold text-rose-700 dark:text-rose-300 uppercase">Incorrect:</span>
				<span class="font-black text-base text-rose-700 dark:text-rose-300">{filterCounts.incorrect}</span>
			</div>

			<div class="p-3 border border-border-color/40 bg-muted/40 flex items-center justify-between">
				<span class="font-bold text-text-muted uppercase">Unattempted:</span>
				<span class="font-black text-base text-text-secondary">{filterCounts.unattempted}</span>
			</div>
		</div>

		<!-- Per-Question Timing Analysis -->
		{#if timingStats}
			<div class="p-4 bg-muted/30 border-2 border-border-color/60 font-mono text-xs space-y-2">
				<span class="font-bold uppercase text-text-primary block text-[11px]">
					⏱️ Speed & Time Analytics
				</span>
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<div>
						<span class="text-[10px] text-text-muted uppercase block">Average Pace / Question</span>
						<span class="font-bold text-text-primary">{formatSecondsToText(timingStats.avgSecs)}</span>
					</div>
					<div>
						<span class="text-[10px] text-text-muted uppercase block">Fastest Question</span>
						<span class="font-bold text-emerald-600 dark:text-emerald-400">
							Q#{timingStats.fastestQNumber} ({formatSecondsToText(timingStats.fastestSecs)})
						</span>
					</div>
					<div>
						<span class="text-[10px] text-text-muted uppercase block">Longest Time Spent</span>
						<span class="font-bold text-amber-600 dark:text-amber-400">
							Q#{timingStats.slowestQNumber} ({formatSecondsToText(timingStats.slowestSecs)})
						</span>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Review Filters & Sort Control Bar -->
	<div class="neo-box p-4 sm:p-5 bg-surface space-y-4">
		<!-- Search & Sort Row -->
		<div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
			<div class="relative flex-1">
				<input
					type="text"
					placeholder="Filter questions by keywords, formulas, or question number..."
					bind:value={reviewSearchQuery}
					class="neo-input w-full text-xs pr-8"
				/>
				{#if reviewSearchQuery}
					<button
						type="button"
						onclick={() => (reviewSearchQuery = '')}
						class="absolute inset-y-0 right-0 flex items-center pr-3 font-mono text-xs text-text-muted hover:text-text-primary"
					>
						✕
					</button>
				{/if}
			</div>

			<div class="flex items-center gap-2 shrink-0">
				<label for="review-sort" class="font-mono text-xs font-bold uppercase text-text-muted">
					Sort:
				</label>
				<select
					id="review-sort"
					bind:value={reviewSortBy}
					class="neo-input text-xs font-mono py-1.5 pr-8"
				>
					<option value="question_asc">Question Number (Ascending)</option>
					<option value="question_desc">Question Number (Descending)</option>
					<option value="time_desc">Time Spent (High to Low)</option>
					<option value="time_asc">Time Spent (Low to High)</option>
					<option value="marks_desc">Marks Awarded (High to Low)</option>
					<option value="marks_asc">Marks Awarded (Low to High)</option>
				</select>
			</div>
		</div>

		<!-- Filter Pills Row -->
		<div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-color/20 font-mono text-xs">
			<div class="flex flex-wrap items-center gap-1.5">
				<span class="font-bold text-text-muted text-[11px] uppercase mr-1">Status:</span>

				<button
					type="button"
					onclick={() => (reviewStatusFilter = 'all')}
					class={`neo-badge cursor-pointer ${reviewStatusFilter === 'all' ? 'bg-accent-contrast text-accent-contrast-text' : 'bg-muted'}`}
				>
					All ({filterCounts.total})
				</button>
				<button
					type="button"
					onclick={() => (reviewStatusFilter = 'correct')}
					class={`neo-badge cursor-pointer ${reviewStatusFilter === 'correct' ? 'bg-emerald-600 text-white' : 'bg-muted'}`}
				>
					Correct ({filterCounts.correct})
				</button>
				{#if filterCounts.partial > 0}
					<button
						type="button"
						onclick={() => (reviewStatusFilter = 'partial')}
						class={`neo-badge cursor-pointer ${reviewStatusFilter === 'partial' ? 'bg-amber-500 text-white' : 'bg-muted'}`}
					>
						Partial ({filterCounts.partial})
					</button>
				{/if}
				<button
					type="button"
					onclick={() => (reviewStatusFilter = 'incorrect')}
					class={`neo-badge cursor-pointer ${reviewStatusFilter === 'incorrect' ? 'bg-rose-600 text-white' : 'bg-muted'}`}
				>
					Incorrect ({filterCounts.incorrect})
				</button>
				<button
					type="button"
					onclick={() => (reviewStatusFilter = 'unattempted')}
					class={`neo-badge cursor-pointer ${reviewStatusFilter === 'unattempted' ? 'bg-accent-contrast text-accent-contrast-text' : 'bg-muted'}`}
				>
					Unattempted ({filterCounts.unattempted})
				</button>
				{#if filterCounts.marked > 0}
					<button
						type="button"
						onclick={() => (reviewStatusFilter = 'marked')}
						class={`neo-badge cursor-pointer ${reviewStatusFilter === 'marked' ? 'bg-amber-500 text-white' : 'bg-muted'}`}
					>
						Marked ({filterCounts.marked})
					</button>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				{#if hasActiveFilters}
					<button
						type="button"
						onclick={resetFilters}
						class="text-xs text-text-muted hover:text-text-primary underline cursor-pointer"
					>
						Reset Filters
					</button>
				{/if}
				<span class="font-bold text-text-secondary text-[11px]">
					Showing {displayedQuestions.length} of {testQuestions.length} Questions
				</span>
			</div>
		</div>
	</div>

	<!-- Questions Detailed Review List -->
	{#if displayedQuestions.length === 0}
		<div class="neo-box p-8 text-center bg-surface space-y-3">
			<p class="font-mono text-xs text-text-muted uppercase">No questions match your active review filter.</p>
			<button
				type="button"
				onclick={resetFilters}
				class="neo-btn text-xs py-1.5 px-3"
			>
				Reset Filters
			</button>
		</div>
	{:else}
		<div class="space-y-4">
			{#each displayedQuestions as item (item.q.id)}
				<ReviewQuestionCard
					{item}
					onzoom={(z) => (zoomedImage = z)}
				/>
			{/each}
		</div>
	{/if}

	<!-- Image Lightbox Modal for Enlarge View -->
	<ImageLightboxModal
		image={zoomedImage}
		onclose={() => (zoomedImage = null)}
	/>
</div>
