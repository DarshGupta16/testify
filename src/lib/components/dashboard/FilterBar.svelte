<script lang="ts">
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

function handleSearchInput(e: Event) {
	const val = (e.target as HTMLInputElement).value;
	app.filter.setSearch(val);
}

function handleSubjectClick(subjectId: CategoryFilter) {
	app.filter.setCategory(subjectId);
}

function handleSortChange(e: Event) {
	const val = (e.target as HTMLSelectElement).value as SortOption;
	app.filter.setSort(val);
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

			<!-- Sort Control -->
			<div class="flex items-center gap-2 shrink-0">
				<label for="sort-select" class="font-mono text-xs font-bold uppercase tracking-wider text-text-muted shrink-0">
					Sort:
				</label>
				<select
					id="sort-select"
					value={app.filter.sortBy}
					onchange={handleSortChange}
					class="neo-input text-xs font-mono py-1.5 sm:py-2 pr-8"
				>
					{#each sortOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
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

		<div class="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto pt-1 sm:pt-0 shrink-0">
			<div class="flex items-center gap-2 sm:gap-2.5">
				{#if app.filter.searchQuery || app.filter.selectedCategory !== 'All'}
					<button
						type="button"
						onclick={() => app.filter.reset()}
						class="font-mono text-xs text-text-muted hover:text-text-primary underline cursor-pointer"
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

			<div class="flex items-center gap-1.5">
				<button
					type="button"
					onclick={() => app.modals.openFolders()}
					class="neo-btn text-xs py-1 px-2.5 font-bold flex items-center gap-1.5 hover:bg-muted cursor-pointer"
					title="Configure Folders"
				>
					<span>📁</span>
					<span>Folders</span>
				</button>

				<button
					type="button"
					onclick={() => app.modals.openSubjects()}
					class="neo-btn text-xs py-1 px-2.5 font-bold flex items-center gap-1.5 hover:bg-muted cursor-pointer"
					title="Configure Subjects"
				>
					<span>⚙️</span>
					<span>Subjects</span>
				</button>
			</div>
		</div>
	</div>
</div>
