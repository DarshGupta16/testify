<script lang="ts">
import EmptyState from '$lib/components/dashboard/EmptyState.svelte';
import FilterBar from '$lib/components/dashboard/FilterBar.svelte';
import StatsBar from '$lib/components/dashboard/StatsBar.svelte';
import TestCard from '$lib/components/dashboard/TestCard.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();
</script>

<svelte:head>
	<title>Testify — Neobrutalist Test Engine & PDF Exam Simulator</title>
	<meta
		name="description"
		content="Convert any test or assignment PDF into an interactive, timed exam with KaTeX math rendering, MuPDF diagram extraction, and instant scorecards."
	/>
</svelte:head>

<div class="mx-auto max-w-7xl px-3.5 py-4 sm:px-6 sm:py-8">
	{#if app.tests.totalTests === 0}
		<!-- Zero Tests: Show Centered Empty State with Direct Upload Form -->
		<EmptyState />
	{:else}
		<!-- Active Dashboard with Tests -->
		<div class="space-y-4 sm:space-y-6 animate-fade-in">
			<!-- Dashboard Title & Action Row -->
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b-2 border-border-color pb-4 sm:pb-5">
				<div>
					<div class="flex items-center gap-2 mb-1">
						<span class="inline-block h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></span>
						<span class="font-mono text-xs font-bold text-text-muted">
							{app.tests.totalTests} {app.tests.totalTests === 1 ? 'Exam' : 'Exams'} Available
						</span>
					</div>
					<h1 class="text-2xl sm:text-4xl font-black uppercase tracking-tight text-text-primary">
						Assessment Dashboard
					</h1>
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

			<!-- Filter, Search, and Sort Controls -->
			<FilterBar />

			<!-- Tests Grid -->
			{#if app.filteredTests.length === 0}
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
						class="neo-btn text-xs py-2 px-4"
					>
						Reset Search & Filters
					</button>
				</div>
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
