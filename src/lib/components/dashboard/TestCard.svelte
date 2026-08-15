<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { TestItem } from '$lib/types/test';
import { formatDate } from '$lib/utils';

const { test }: { test: TestItem } = $props();
const app = getAppContext();

let isConfirmingDelete = $state(false);

function handleLaunchExam() {
	app.toast.show(`[SIMULATOR] Launching test session for "${test.title}"...`, 'info');
	app.modals.openDetails(test);
}

function handleDelete() {
	if (!isConfirmingDelete) {
		isConfirmingDelete = true;
		return;
	}
	app.handleDeleteTest(test.id);
}
</script>

<article class="neo-box p-5 sm:p-6 flex flex-col justify-between group hover:-translate-y-1 hover:shadow-[6px_6px_0px_var(--shadow-color)] transition-all">
	<!-- Card Top Section -->
	<div>
		<!-- Badges Row -->
		<div class="flex flex-wrap items-center justify-between gap-2 mb-3">
			<span class="neo-badge bg-accent-contrast text-accent-contrast-text">
				{test.subject}
			</span>

			<div class="flex flex-wrap items-center gap-1.5">
				{#if test.extractedDiagramsCount !== undefined && test.extractedDiagramsCount > 0}
					<span class="neo-badge bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px]" title="Extracted diagrams and figures">
						🎨 {test.extractedDiagramsCount} {test.extractedDiagramsCount === 1 ? 'Diagram' : 'Diagrams'}
					</span>
				{/if}
				{#if test.hasAnswerKey}
					<span class="neo-badge bg-emerald-600 dark:bg-emerald-700 text-white" title="Auto-grading key linked">
						✓ Key Linked
					</span>
				{:else}
					<span class="neo-badge bg-muted text-text-muted text-[10px]" title="No answer key provided">
						Practice Only
					</span>
				{/if}
				<span class="font-mono text-[11px] text-text-muted">
					{formatDate(test.createdAt)}
				</span>
			</div>
		</div>

		<!-- Title & Description -->
		<h3 class="text-lg sm:text-xl font-black text-text-primary leading-snug uppercase tracking-tight line-clamp-2 mb-2">
			{test.title}
		</h3>

		{#if test.description}
			<p class="text-xs text-text-secondary line-clamp-2 mb-4">
				{test.description}
			</p>
		{/if}

		<!-- Test Specs Grid -->
		<div class="grid grid-cols-3 gap-2 py-3 border-y-2 border-border-color/20 my-3 font-mono text-xs">
			<div class="flex flex-col">
				<span class="text-[10px] text-text-muted uppercase">Duration</span>
				<span class="font-bold text-text-primary">{test.durationMinutes ? `${test.durationMinutes} Mins` : 'Untimed'}</span>
			</div>
			<div class="flex flex-col">
				<span class="text-[10px] text-text-muted uppercase">Questions</span>
				<span class="font-bold text-text-primary">{test.questionCount} Qs</span>
			</div>
			<div class="flex flex-col">
				<span class="text-[10px] text-text-muted uppercase">Total Marks</span>
				<span class="font-bold text-text-primary">{test.totalMarks} Pts</span>
			</div>
		</div>

		<!-- Attached PDF Files Info -->
		<div class="space-y-1 font-mono text-[11px] text-text-muted mb-5">
			<div class="flex items-center gap-1.5 truncate">
				<span class="text-text-primary font-bold">PDF:</span>
				<span class="truncate text-text-secondary">{test.testFileName}</span>
				<span class="text-[10px]">({test.testFileSizeFormatted})</span>
			</div>
			{#if test.hasAnswerKey && test.answerKeyFileName}
				<div class="flex items-center gap-1.5 truncate">
					<span class="text-emerald-600 dark:text-emerald-400 font-bold">KEY:</span>
					<span class="truncate text-text-secondary">{test.answerKeyFileName}</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- Action Footer Buttons -->
	<div class="pt-2 border-t border-border-color/20 flex flex-col gap-2">
		<!-- Primary Launch Exam Button -->
		<button
			type="button"
			onclick={handleLaunchExam}
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

		<!-- Sub Actions: Details & Delete -->
		<div class="flex items-center justify-between gap-2">
			<button
				type="button"
				onclick={() => app.modals.openDetails(test)}
				class="neo-btn text-xs py-1.5 px-3 flex-1"
			>
				View Structure
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
