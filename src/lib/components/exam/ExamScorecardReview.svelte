<script lang="ts">
import ImageLightboxModal from '$lib/components/common/ImageLightboxModal.svelte';
import {
	calculateAttemptTimingStats,
	type EnrichedReviewQuestion,
	getEnrichedReviewQuestions,
} from '$lib/services/assessmentEvaluator';
import type { TestAttempt, TestItem } from '$lib/types/test';
import ReviewQuestionCard from './ReviewQuestionCard.svelte';
import ReviewFilterBar, {
	type ReviewSortOption,
	type ReviewStatusFilter,
	type ReviewTypeFilter,
} from './scorecard/ReviewFilterBar.svelte';
import ScorecardMetricsHero from './scorecard/ScorecardMetricsHero.svelte';

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
let reviewStatusFilter = $state<ReviewStatusFilter>('all');
let reviewTypeFilter = $state<ReviewTypeFilter>('all');
let reviewSortBy = $state<ReviewSortOption>('question_asc');
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

<div class="space-y-6 sm:space-y-8 animate-fade-in pb-12">
	<!-- Scorecard Hero Summary Card -->
	<ScorecardMetricsHero
		{attempt}
		{timingStats}
		{filterCounts}
		{onexitreview}
		{onretakepractice}
		{onretakeexam}
	/>

	<!-- Review Filters & Sort Control Bar -->
	<ReviewFilterBar
		bind:reviewSearchQuery
		bind:reviewSortBy
		bind:reviewStatusFilter
		bind:reviewTypeFilter
		{filterCounts}
		totalQuestions={testQuestions.length}
		displayedCount={displayedQuestions.length}
		{hasActiveFilters}
		onresetfilters={resetFilters}
	/>

	<!-- Questions Detailed Review List -->
	{#if displayedQuestions.length === 0}
		<div class="neo-box p-8 text-center bg-surface space-y-3">
			<p class="font-mono text-xs text-text-muted uppercase">No questions match your active review filter.</p>
			<button
				type="button"
				onclick={resetFilters}
				class="neo-btn text-xs py-1.5 px-3 cursor-pointer"
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
