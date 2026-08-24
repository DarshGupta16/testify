<script lang="ts">
export type ReviewStatusFilter =
	| 'all'
	| 'correct'
	| 'partial'
	| 'incorrect'
	| 'unattempted'
	| 'marked';

export type ReviewSortOption =
	| 'question_asc'
	| 'question_desc'
	| 'time_desc'
	| 'time_asc'
	| 'marks_desc'
	| 'marks_asc';

export type ReviewTypeFilter = 'all' | 'single_choice' | 'multi_choice' | 'numerical';

let {
	reviewSearchQuery = $bindable(''),
	reviewSortBy = $bindable<ReviewSortOption>('question_asc'),
	reviewStatusFilter = $bindable<ReviewStatusFilter>('all'),
	reviewTypeFilter = $bindable<ReviewTypeFilter>('all'),
	filterCounts,
	totalQuestions,
	displayedCount,
	hasActiveFilters,
	onresetfilters,
}: {
	reviewSearchQuery: string;
	reviewSortBy: ReviewSortOption;
	reviewStatusFilter: ReviewStatusFilter;
	reviewTypeFilter?: ReviewTypeFilter;
	filterCounts: {
		total: number;
		correct: number;
		partial: number;
		incorrect: number;
		unattempted: number;
		marked: number;
	};
	totalQuestions: number;
	displayedCount: number;
	hasActiveFilters: boolean;
	onresetfilters: () => void;
} = $props();
</script>

<div class="neo-box p-3.5 sm:p-5 bg-surface space-y-3.5 sm:space-y-4">
	<!-- Search & Sort Row -->
	<div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3">
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
					class="absolute inset-y-0 right-0 flex items-center pr-3 font-mono text-xs font-bold text-text-muted hover:text-text-primary cursor-pointer"
					title="Clear search"
				>
					✕
				</button>
			{/if}
		</div>

		<div class="flex items-center justify-between sm:justify-start gap-2 shrink-0">
			<label for="review-sort" class="font-mono text-xs font-bold uppercase text-text-muted shrink-0">
				Sort:
			</label>
			<select
				id="review-sort"
				bind:value={reviewSortBy}
				class="neo-input text-xs font-mono py-1.5 pr-8 flex-1 sm:flex-initial"
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
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-border-color/20 font-mono text-xs">
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

		<div class="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
			{#if hasActiveFilters}
				<button
					type="button"
					onclick={onresetfilters}
					class="text-xs text-text-muted hover:text-text-primary underline cursor-pointer"
				>
					Reset Filters
				</button>
			{/if}
			<span class="font-bold text-text-secondary text-[11px]">
				Showing {displayedCount} of {totalQuestions}
			</span>
		</div>
	</div>
</div>
