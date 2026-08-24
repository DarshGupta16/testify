<script lang="ts">
import { goto, preloadCode } from '$app/navigation';
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { TestItem } from '$lib/types/test';
import { formatDate } from '$lib/utils';

const { test }: { test: TestItem } = $props();
const app = getAppContext();

let isSelectingMode = $state(false);
let isConfirmingDelete = $state(false);
let modeTimer: ReturnType<typeof setTimeout> | null = null;

function handleStartClick() {
	isSelectingMode = true;
	if (modeTimer) clearTimeout(modeTimer);
	modeTimer = setTimeout(() => {
		isSelectingMode = false;
		modeTimer = null;
	}, 10000);
}

function handleSelectPractice() {
	if (modeTimer) clearTimeout(modeTimer);
	isSelectingMode = false;
	goto(`/test/${test.id}?start=true&mode=practice`);
}

function handleSelectExam() {
	if (modeTimer) clearTimeout(modeTimer);
	isSelectingMode = false;
	goto(`/test/${test.id}?start=true&mode=exam`);
}

$effect(() => {
	return () => {
		if (modeTimer) clearTimeout(modeTimer);
	};
});

function handleDelete() {
	if (!isConfirmingDelete) {
		isConfirmingDelete = true;
		return;
	}
	app.handleDeleteTest(test.id);
}
</script>

<article
	onmouseenter={() => preloadCode(`/test/${test.id}`)}
	class="neo-box p-4 sm:p-6 flex flex-col justify-between group hover:-translate-y-1 hover:shadow-[6px_6px_0px_var(--shadow-color)] transition-all"
>
	<!-- Card Top Section -->
	<div>
		<!-- Badges Row -->
		<div class="flex flex-wrap items-center justify-between gap-2 mb-3">
			<span class="neo-badge bg-accent-contrast text-accent-contrast-text">
				{app.subjects.getName(test.subjectId) || '?'}
			</span>

			<div class="flex flex-wrap items-center gap-1.5">
				<span class="font-mono text-[11px] text-text-muted">
					{formatDate(test.createdAt)}
				</span>
			</div>
		</div>

		<!-- Title & Description -->
		<h3 class="text-base sm:text-xl font-black text-text-primary leading-snug uppercase tracking-tight line-clamp-2 mb-2">
			{test.title}
		</h3>

		{#if test.description}
			<p class="text-xs text-text-secondary line-clamp-2 mb-3 sm:mb-4">
				{test.description}
			</p>
		{/if}

		<!-- Test Specs Grid -->
		<div class="grid grid-cols-3 gap-1.5 sm:gap-2 py-2.5 sm:py-3 border-y-2 border-border-color/20 my-3 font-mono text-xs">
			<div class="flex flex-col">
				<span class="text-[10px] text-text-muted uppercase">Duration</span>
				<span class="font-bold text-text-primary text-[11px] sm:text-xs truncate">{test.durationMinutes ? `${test.durationMinutes} Mins` : 'Untimed'}</span>
			</div>
			<div class="flex flex-col">
				<span class="text-[10px] text-text-muted uppercase">Questions</span>
				<span class="font-bold text-text-primary text-[11px] sm:text-xs">{test.questions?.length || 0} Qs</span>
			</div>
			<div class="flex flex-col">
				<span class="text-[10px] text-text-muted uppercase">Total Marks</span>
				<span class="font-bold text-text-primary text-[11px] sm:text-xs">{test.totalMarks} Pts</span>
			</div>
		</div>

		<!-- Attached PDF Files Info -->
		<div class="space-y-1.5 font-mono text-[11px] text-text-muted mb-4 sm:mb-5">
			<div class="flex items-center gap-1.5 truncate">
				<span class="text-text-primary font-bold">PDF:</span>
				<span class="truncate text-text-secondary">{test.testFileName}</span>
				<span class="text-[10px]">({test.testFileSizeFormatted})</span>
			</div>
		</div>
	</div>

	<!-- Action Footer Buttons -->
	<div class="pt-2 border-t border-border-color/20 flex flex-col gap-2">
		<!-- Primary Start Test / Mode Selector Slot -->
		{#if isSelectingMode}
			<div class="grid grid-cols-2 gap-2 animate-slide-down">
				<button
					type="button"
					onclick={handleSelectPractice}
					class="neo-btn text-[11px] py-2.5 px-2 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25 font-bold truncate"
					title="Start in Practice Mode"
				>
					🌿 Practice
				</button>
				<button
					type="button"
					onclick={handleSelectExam}
					class="neo-btn neo-btn-primary text-[11px] py-2.5 px-2 font-bold truncate"
					title="Start Exam Simulation"
				>
					🎯 Exam Sim
				</button>
			</div>
		{:else}
			<button
				type="button"
				onmouseenter={() => preloadCode(`/test/${test.id}`)}
				onclick={handleStartClick}
				class="neo-btn neo-btn-primary w-full text-xs py-2.5"
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
					<polygon points="5 3 19 12 5 21 5 3" />
				</svg>
				<span>Start Test</span>
			</button>
		{/if}

		<!-- Sub Actions: Details & Delete -->
		<div class="flex items-center justify-between gap-2">
			<button
				type="button"
				onmouseenter={() => preloadCode(`/test/${test.id}`)}
				onclick={() => app.modals.openDetails(test)}
				class="neo-btn text-xs py-1.5 px-3 flex-1 text-center"
			>
				View Details
			</button>

			{#if isConfirmingDelete}
				<div class="flex items-center gap-1 flex-1">
					<button
						type="button"
						onclick={handleDelete}
						class="neo-btn neo-btn-danger text-xs py-1.5 px-2 flex-1"
					>
						Confirm
					</button>
					<button
						type="button"
						onclick={() => (isConfirmingDelete = false)}
						class="neo-btn text-xs py-1.5 px-2"
						title="Cancel delete"
					>
						✕
					</button>
				</div>
			{:else}
				<button
					type="button"
					onclick={handleDelete}
					class="neo-btn text-xs py-1.5 px-3 text-rose-500 hover:bg-rose-600 hover:text-white"
					title="Delete this test"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="square"
						class="h-3.5 w-3.5"
					>
						<polyline points="3 6 5 6 21 6" />
						<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
					</svg>
				</button>
			{/if}
		</div>
	</div>
</article>
