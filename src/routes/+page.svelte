<script lang="ts">
import { untrack } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import EmptyState from '$lib/components/dashboard/EmptyState.svelte';
import FilterBar from '$lib/components/dashboard/FilterBar.svelte';
import FolderBreadcrumbs from '$lib/components/dashboard/FolderBreadcrumbs.svelte';
import FolderEmptyState from '$lib/components/dashboard/FolderEmptyState.svelte';
import StatsBar from '$lib/components/dashboard/StatsBar.svelte';
import SubfoldersGrid from '$lib/components/dashboard/SubfoldersGrid.svelte';
import TestCard from '$lib/components/dashboard/TestCard.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

const activeFolder = $derived(app.folders.activeFolder);
const activeFolderId = $derived(app.folders.activeFolderId);
const isInsideFolder = $derived(Boolean(activeFolderId));

// URL Sync with SvelteKit $page.url.searchParams.get('folder') with Guard
$effect(() => {
	if (!app.folders.isInitialized || app.isDeletingFolder) return;

	const folderParam = page.url.searchParams.get('folder');
	if (folderParam) {
		const exists = app.folders.folderMap.has(folderParam);
		if (exists) {
			untrack(() => {
				if (app.folders.activeFolderId !== folderParam) {
					app.folders.setActiveFolder(folderParam);
				}
			});
		} else {
			app.toast.show('Folder not found or has been deleted.', 'warning');
			untrack(() => {
				app.folders.setActiveFolder(null);
			});
			goto('/', { replaceState: true });
		}
	} else {
		untrack(() => {
			if (app.folders.activeFolderId !== null) {
				app.folders.setActiveFolder(null);
			}
		});
	}
});

const isFilterActive = $derived(
	Boolean(app.filter.searchQuery.trim() || app.filter.selectedCategory !== 'All')
);
const isFilterEmpty = $derived(app.filteredTests.length === 0 && isFilterActive);
</script>

<svelte:head>
	<title>
		{activeFolder ? `${activeFolder.name} — Testify` : 'Testify — Test Engine & PDF Exam Simulator'}
	</title>
	<meta
		name="description"
		content="Convert any test or assignment PDF into an interactive, timed exam with KaTeX math rendering, MuPDF diagram extraction, and instant scorecards."
	/>
</svelte:head>

<div class="mx-auto max-w-7xl px-3.5 py-4 sm:px-6 sm:py-8">
	{#if app.tests.totalTests === 0 && app.folders.folders.length === 0}
		<!-- Zero Tests & Zero Folders: Show Centered Empty State with Direct Upload Form -->
		<EmptyState />
	{:else}
		<!-- Active Dashboard -->
		<div class="space-y-4 sm:space-y-6 animate-fade-in">
			<!-- Dashboard Title & Action Row (Dynamic per folder context) -->
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b-2 border-border-color pb-4 sm:pb-5">
				<div>
					<div class="flex items-center gap-2 mb-1">
						<span class="inline-block h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></span>
						<span class="font-mono text-xs font-bold text-text-muted">
							{#if isInsideFolder}
								FOLDER: {activeFolder?.name} &bull; {app.filteredTests.length} {app.filteredTests.length === 1 ? 'Exam' : 'Exams'}
							{:else}
								{app.tests.totalTests} {app.tests.totalTests === 1 ? 'Exam' : 'Exams'} Available
							{/if}
						</span>
					</div>

					<h1 class="text-2xl sm:text-4xl font-black uppercase tracking-tight text-text-primary">
						{activeFolder ? activeFolder.name : 'Assessment Dashboard'}
					</h1>

					{#if activeFolder?.description}
						<p class="text-xs sm:text-sm text-text-secondary mt-1 max-w-2xl">
							{activeFolder.description}
						</p>
					{/if}
				</div>

				<div class="flex flex-wrap items-center gap-2 sm:gap-3">
					<button
						type="button"
						onclick={() => app.modals.openUpload()}
						class="neo-btn neo-btn-primary text-[11px] sm:text-xs py-1.5 px-3 sm:py-2 sm:px-4 font-bold inline-flex items-center gap-1.5"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="square"
							class="h-3 w-3 sm:h-3.5 sm:w-3.5"
						>
							<line x1="12" y1="5" x2="12" y2="19" />
							<line x1="5" y1="12" x2="19" y2="12" />
						</svg>
						<span>Upload Test PDF</span>
					</button>
				</div>
			</div>

			<!-- Quick Metric Stats -->
			<StatsBar />

			<!-- Breadcrumb Navigation Bar -->
			<FolderBreadcrumbs />

			<!-- Subfolders Grid -->
			<SubfoldersGrid />

			<!-- Filter, Search, and Sort Controls -->
			<FilterBar />

			<!-- Assessments Display Area -->
			{#if isFilterEmpty}
				<!-- No Filter Matches -->
				<div class="neo-box p-8 sm:p-12 text-center bg-surface my-8 space-y-4">
					<div class="mx-auto flex h-12 w-12 items-center justify-center border-2 border-border-color bg-muted">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="square"
							class="h-6 w-6 text-text-muted"
						>
							<circle cx="11" cy="11" r="8" />
							<line x1="21" y1="21" x2="16.65" y2="16.65" />
						</svg>
					</div>
					<div>
						<h3 class="font-mono text-base font-bold uppercase text-text-primary">
							No Assessments Found
						</h3>
						<p class="text-xs text-text-secondary mt-1">
							No tests match your current search query or active category filters.
						</p>
					</div>
					<button
						type="button"
						onclick={() => app.filter.reset()}
						class="neo-btn text-xs py-2 px-4 font-bold"
					>
						Reset Search & Filters
					</button>
				</div>
			{:else if app.filteredTests.length === 0}
				{#if isInsideFolder}
					{#if app.folders.subfolders.length === 0}
						<!-- Contextual Folder Empty State -->
						<FolderEmptyState />
					{:else}
						<!-- Subtle prompt when inside a folder with subfolders but no direct tests -->
						<div class="neo-box p-6 text-center bg-surface/50 border-dashed border-2 border-border-color my-4">
							<p class="font-mono text-xs uppercase tracking-wider text-text-muted">
								📁 No direct assessments in this folder
							</p>
							<p class="text-xs text-text-secondary mt-1">
								Select a subfolder above, drag assessments here, or upload a new test PDF.
							</p>
						</div>
					{/if}
				{:else}
					<!-- At root with folders existing but 0 uncategorized tests -->
					<div class="neo-box p-6 text-center bg-surface/50 border-dashed border-2 border-border-color my-4">
						<p class="font-mono text-xs uppercase tracking-wider text-text-muted">
							📂 All assessments organized in folders
						</p>
						<p class="text-xs text-text-secondary mt-1">
							Select a folder above or upload a new test PDF to get started.
						</p>
					</div>
				{/if}
			{:else}
				<!-- Grid of Test Cards -->
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{#each app.filteredTests as test (test.id)}
						<TestCard {test} />
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
