<script lang="ts">
import { getTestStore } from '$lib/stores/testStore.svelte';
import type { CategoryFilter, SortOption } from '$lib/types/test';

const store = getTestStore();

const categories: CategoryFilter[] = [
	'All',
	'STEM',
	'Computer Science',
	'Humanities',
	'Languages',
	'General',
];

const sortOptions: { label: string; value: SortOption }[] = [
	{ label: 'Newest First', value: 'newest' },
	{ label: 'Oldest First', value: 'oldest' },
	{ label: 'Most Questions', value: 'questions-desc' },
	{ label: 'Least Questions', value: 'questions-asc' },
	{ label: 'Longest Duration', value: 'duration-desc' },
	{ label: 'Title (A-Z)', value: 'title-asc' },
];

function handleSearchInput(e: Event) {
	const val = (e.target as HTMLInputElement).value;
	store.setSearch(val);
}

function handleCategoryClick(cat: CategoryFilter) {
	store.setCategory(cat);
}

function handleSortChange(e: Event) {
	const val = (e.target as HTMLSelectElement).value as SortOption;
	store.setSort(val);
}
</script>

<div class="neo-box p-4 sm:p-5 mb-8 space-y-4">
	<!-- Top Row: Search + Sort + Clear -->
	<div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
		<!-- Search Input -->
		<div class="relative flex-1">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-text-muted">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="square"
					class="h-4 w-4"
				>
					<circle cx="11" cy="11" r="8" />
					<line x1="21" y1="21" x2="16.65" y2="16.65" />
				</svg>
			</div>
			<input
				type="text"
				placeholder="Search assessments by title, subject, filename, or tags..."
				value={store.searchQuery}
				oninput={handleSearchInput}
				class="neo-input w-full !pl-11 pr-8 text-sm"
			/>
			{#if store.searchQuery}
				<button
					type="button"
					onclick={() => store.setSearch('')}
					class="absolute inset-y-0 right-0 flex items-center pr-3 font-mono text-xs font-bold text-text-muted hover:text-text-primary"
					title="Clear search"
				>
					✕
				</button>
			{/if}
		</div>

		<!-- Sort Control -->
		<div class="flex items-center gap-2 shrink-0">
			<label for="sort-select" class="font-mono text-xs font-bold uppercase tracking-wider text-text-muted shrink-0">
				Sort:
			</label>
			<select
				id="sort-select"
				value={store.sortBy}
				onchange={handleSortChange}
				class="neo-input text-xs font-mono py-2 pr-8"
			>
				{#each sortOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Bottom Row: Category Pills -->
	<div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-color/20">
		<div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
			<span class="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted mr-1">
				Filter:
			</span>
			{#each categories as category}
				<button
					type="button"
					onclick={() => handleCategoryClick(category)}
					class={`neo-badge cursor-pointer transition-all ${
						store.selectedCategory === category
							? 'bg-accent-contrast text-accent-contrast-text border-border-color shadow-[2px_2px_0px_var(--shadow-color)]'
							: 'hover:bg-muted opacity-80 hover:opacity-100'
					}`}
				>
					{category}
				</button>
			{/each}
		</div>

		<div class="flex items-center gap-2">
			{#if store.searchQuery || store.selectedCategory !== 'All'}
				<button
					type="button"
					onclick={() => {
						store.setSearch('');
						store.setCategory('All');
					}}
					class="font-mono text-xs text-text-muted hover:text-text-primary underline cursor-pointer"
				>
					Reset Filters
				</button>
			{/if}
			<span class="font-mono text-xs font-bold text-text-secondary">
				Showing {store.filteredTests.length} of {store.totalTests}
			</span>
		</div>
	</div>
</div>
