<script lang="ts">
import { clickOutside } from '$lib/actions/clickOutside';
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { CategoryFilter, SortOption } from '$lib/types/test';

const app = getAppContext();

const sortOptions: { label: string; value: SortOption }[] = [
	{ label: 'Newest First', value: 'newest' },
	{ label: 'Oldest First', value: 'oldest' },
	{ label: 'Most Questions', value: 'questions-desc' },
	{ label: 'Least Questions', value: 'questions-asc' },
	{ label: 'Longest Duration', value: 'duration-desc' },
	{ label: 'Title (A-Z)', value: 'title-asc' },
];

let isSortOpen = $state(false);

const currentSortLabel = $derived(
	sortOptions.find((o) => o.value === app.filter.sortBy)?.label ?? 'Sort'
);

function handleSearchInput(e: Event) {
	const val = (e.target as HTMLInputElement).value;
	app.filter.setSearch(val);
}

function handleSubjectClick(subjectId: CategoryFilter) {
	app.filter.setCategory(subjectId);
}
</script>

<div class="neo-box p-3.5 sm:p-5 mb-6 sm:mb-8 space-y-3.5 sm:space-y-4">
	<!-- Top Row: Search + Folder Scope Toggle + Sort Control -->
	<div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-3">
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
				placeholder="Search assessments by title, subject, or filename..."
				value={app.filter.searchQuery}
				oninput={handleSearchInput}
				class="neo-input w-full !pl-11 pr-8 text-xs sm:text-sm"
			/>
			{#if app.filter.searchQuery}
				<button
					type="button"
					onclick={() => app.filter.setSearch('')}
					class="absolute inset-y-0 right-0 flex items-center pr-3 font-mono text-xs font-bold text-text-muted hover:text-text-primary cursor-pointer"
					title="Clear search"
				>
					✕
				</button>
			{/if}
		</div>

		<!-- Scope and Sort Row -->
		<div class="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0">
			<!-- Folder Scope Toggle -->
			<div class="flex items-center border-2 border-border-color bg-surface shadow-[2px_2px_0px_var(--shadow-color)] overflow-hidden font-mono text-[11px] font-bold shrink-0">
				<button
					type="button"
					onclick={() => app.filter.setFolderScope('current')}
					class={`px-2.5 py-1.5 transition-colors cursor-pointer ${
						app.filter.folderScope === 'current'
							? 'bg-accent-contrast text-accent-contrast-text'
							: 'hover:bg-muted text-text-muted'
					}`}
					title="Show tests in the current folder only"
				>
					📁 {app.folders.activeFolder ? 'In This Folder' : 'Root Only'}
				</button>
				<button
					type="button"
					onclick={() => app.filter.setFolderScope('all')}
					class={`px-2.5 py-1.5 border-l-2 border-border-color transition-colors cursor-pointer ${
						app.filter.folderScope === 'all'
							? 'bg-accent-contrast text-accent-contrast-text'
							: 'hover:bg-muted text-text-muted'
					}`}
					title="Show tests across all folders and subfolders"
				>
					🌐 All Folders
				</button>
			</div>

			<!-- Compact Sort Dropdown Trigger -->
			<div class={`relative shrink-0 ${isSortOpen ? 'z-50' : ''}`}>
				<button
					type="button"
					onclick={(e) => {
						e.stopPropagation();
						isSortOpen = !isSortOpen;
					}}
					class={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-border-color bg-surface shadow-[2px_2px_0px_var(--shadow-color)] font-mono text-[11px] font-bold cursor-pointer transition-all ${
						isSortOpen
							? 'bg-accent-contrast text-accent-contrast-text'
							: 'hover:bg-muted text-text-primary'
					}`}
					title={`Sort: ${currentSortLabel}`}
					aria-label="Sort options menu"
					aria-haspopup="menu"
					aria-expanded={isSortOpen}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="square"
						class="h-3.5 w-3.5"
					>
						<path d="m3 7 4-4 4 4M7 3v18m14-4-4 4-4-4m4 4V3" />
					</svg>
					<span class="sm:hidden">Sort</span>
					<span class="hidden sm:inline">{currentSortLabel}</span>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						class={`w-3 h-3 transition-transform ${isSortOpen ? 'rotate-180' : ''}`}
					>
						<path
							fill-rule="evenodd"
							d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>

				{#if isSortOpen}
					<div
						role="menu"
						use:clickOutside={() => (isSortOpen = false)}
						onkeydown={(e) => {
							if (e.key === 'Escape') isSortOpen = false;
						}}
						tabindex="-1"
						class="absolute right-0 top-full mt-1.5 z-50 w-48 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] py-1 font-mono text-xs animate-slide-down"
					>
						<div class="px-2.5 py-1 text-[10px] text-text-muted uppercase border-b border-border-color/20 font-bold">
							Sort Options
						</div>
						{#each sortOptions as option}
							<button
								type="button"
								role="menuitem"
								onclick={() => {
									app.filter.setSort(option.value);
									isSortOpen = false;
								}}
								class={`w-full text-left px-3 py-1.5 hover:bg-muted/80 flex items-center justify-between gap-2 font-mono text-xs cursor-pointer transition-colors ${
									app.filter.sortBy === option.value
										? 'bg-accent-contrast/10 font-black text-accent-contrast'
										: 'text-text-primary'
								}`}
							>
								<span>{option.label}</span>
								{#if app.filter.sortBy === option.value}
									<span class="text-xs font-black text-accent-contrast">✓</span>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Bottom Row: Subject Pills & Manage Buttons -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pt-2 border-t border-border-color/20">
		<div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
			<span class="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted mr-1">
				Subject:
			</span>
			<button
				type="button"
				onclick={() => handleSubjectClick('All')}
				class={`neo-badge cursor-pointer transition-all ${
					app.filter.selectedCategory === 'All'
						? 'bg-accent-contrast text-accent-contrast-text border-border-color shadow-[2px_2px_0px_var(--shadow-color)]'
						: 'hover:bg-muted opacity-80 hover:opacity-100'
				}`}
			>
				All
			</button>
			{#each app.subjects.subjects as sub (sub.id)}
				<button
					type="button"
					onclick={() => handleSubjectClick(sub.id)}
					class={`neo-badge cursor-pointer transition-all ${
						app.filter.selectedCategory === sub.id || app.filter.selectedCategory === sub.name
							? 'bg-accent-contrast text-accent-contrast-text border-border-color shadow-[2px_2px_0px_var(--shadow-color)]'
							: 'hover:bg-muted opacity-80 hover:opacity-100'
					}`}
				>
					{sub.name}
				</button>
			{/each}
		</div>

		<div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto pt-1 sm:pt-0">
			<div class="flex items-center gap-2 sm:gap-2.5 min-w-0">
				{#if app.filter.searchQuery || app.filter.selectedCategory !== 'All'}
					<button
						type="button"
						onclick={() => app.filter.reset()}
						class="font-mono text-xs text-text-muted hover:text-text-primary underline cursor-pointer shrink-0"
					>
						Reset
					</button>
				{/if}
				<!-- Contextual Counter Format -->
				<span class="font-mono text-xs font-bold text-text-secondary truncate">
					{#if app.filter.folderScope === 'current'}
						{app.filteredTests.length} in folder ({app.tests.totalTests} total)
					{:else}
						{app.filteredTests.length} across all ({app.tests.totalTests} total)
					{/if}
				</span>
			</div>

			<div class="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
				<button
					type="button"
					onclick={() => app.modals.openFolders()}
					class="neo-btn text-xs py-1 px-2.5 font-bold flex items-center justify-center gap-1.5 hover:bg-muted cursor-pointer"
					title="Configure Folders"
				>
					<span>📁</span>
					<span>Folders</span>
				</button>

				<button
					type="button"
					onclick={() => app.modals.openSubjects()}
					class="neo-btn text-xs py-1 px-2.5 font-bold flex items-center justify-center gap-1.5 hover:bg-muted cursor-pointer"
					title="Configure Subjects"
				>
					<span>⚙️</span>
					<span>Subjects</span>
				</button>
			</div>
		</div>
	</div>
</div>
