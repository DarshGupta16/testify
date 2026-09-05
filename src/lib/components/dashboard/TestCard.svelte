<script lang="ts">
import { goto, preloadCode } from '$app/navigation';
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { TestItem } from '$lib/types/test';
import { formatDate } from '$lib/utils';

const { test }: { test: TestItem } = $props();
const app = getAppContext();

let isSelectingMode = $state(false);
let isConfirmingDelete = $state(false);
let isMenuOpen = $state(false);
let isRenaming = $state(false);
let renameTitle = $state('');
let modeTimer: ReturnType<typeof setTimeout> | null = null;

function focusOnMount(node: HTMLElement) {
	node.focus();
}

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

function handleStartRename() {
	renameTitle = test.title;
	isRenaming = true;
	isMenuOpen = false;
}

function handleSaveRename() {
	const trimmed = renameTitle.trim();
	if (!trimmed) {
		app.toast.show('Title cannot be empty', 'warning');
		return;
	}
	if (trimmed !== test.title) {
		const updated: TestItem = { ...test, title: trimmed };
		app.tests.updateTest(updated);
		app.toast.show(`Renamed to "${trimmed}"`, 'success');
	}
	isRenaming = false;
}

function handleOpenSimilar() {
	isMenuOpen = false;
	app.modals.openSimilarPaperModal(test);
}

function handleOpenEdit() {
	isMenuOpen = false;
	app.modals.openEdit(test);
}
</script>

<svelte:window
	onclick={(e) => {
		if (isMenuOpen) {
			const target = e.target as HTMLElement | null;
			if (!target?.closest('.test-card-menu-container')) {
				isMenuOpen = false;
			}
		}
	}}
/>

<article
	onmouseenter={() => {
		preloadCode(`/test/${test.id}`);
		app.tests.prefetchTestDocAssets(test.id);
	}}
	class="neo-box p-4 sm:p-6 flex flex-col justify-between group hover:-translate-y-1 hover:shadow-[6px_6px_0px_var(--shadow-color)] transition-all relative"
>
	<!-- Card Top Section -->
	<div>
		<!-- Badges & Actions Row -->
		<div class="flex items-center justify-between gap-2 mb-3">
			<span class="neo-badge bg-accent-contrast text-accent-contrast-text">
				{app.subjects.getName(test.subjectId) || '?'}
			</span>

			<div class="flex items-center gap-2 sm:gap-2.5">
				<span class="font-mono text-[11px] text-text-muted">
					{formatDate(test.createdAt)}
				</span>

				<!-- Three Dots Dropdown Menu -->
				<div class="relative test-card-menu-container">
					<button
						type="button"
						onclick={(e) => {
							e.stopPropagation();
							isMenuOpen = !isMenuOpen;
						}}
						class={`flex h-7 w-7 items-center justify-center cursor-pointer transition-all ${
							isMenuOpen
								? 'border-2 border-border-color bg-accent-contrast text-accent-contrast-text shadow-[2px_2px_0px_var(--shadow-color)]'
								: 'border border-transparent bg-transparent text-text-muted hover:text-text-primary hover:bg-muted/70 hover:border-border-color hover:shadow-[2px_2px_0px_var(--shadow-color)]'
						}`}
						title="Options"
						aria-label="Test options menu"
						aria-expanded={isMenuOpen}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="h-4 w-4"
						>
							<circle cx="12" cy="5" r="1.75" />
							<circle cx="12" cy="12" r="1.75" />
							<circle cx="12" cy="19" r="1.75" />
						</svg>
					</button>

					{#if isMenuOpen}
						<div
							class="absolute right-0 top-full mt-1.5 z-30 w-48 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] py-1 font-mono text-xs animate-slide-down"
							role="menu"
						>
							<button
								type="button"
								onclick={handleStartRename}
								class="w-full text-left px-3 py-2 text-text-primary hover:bg-muted/70 flex items-center gap-2.5 font-bold cursor-pointer transition-colors group"
								role="menuitem"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="square"
									stroke-linejoin="miter"
									class="h-3.5 w-3.5 text-text-muted group-hover:text-text-primary transition-colors shrink-0"
								>
									<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
								</svg>
								<span>Rename</span>
							</button>
							<button
								type="button"
								onclick={handleOpenSimilar}
								class="w-full text-left px-3 py-2 text-text-primary hover:bg-muted/70 flex items-center gap-2.5 font-bold cursor-pointer transition-colors group"
								role="menuitem"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="square"
									stroke-linejoin="miter"
									class="h-3.5 w-3.5 text-text-muted group-hover:text-text-primary transition-colors shrink-0"
								>
									<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
								</svg>
								<span>Generate Similar</span>
							</button>
							<button
								type="button"
								onclick={handleOpenEdit}
								class="w-full text-left px-3 py-2 text-text-primary hover:bg-muted/70 flex items-center gap-2.5 font-bold cursor-pointer transition-colors group"
								role="menuitem"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="square"
									stroke-linejoin="miter"
									class="h-3.5 w-3.5 text-text-muted group-hover:text-text-primary transition-colors shrink-0"
								>
									<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
									<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
								</svg>
								<span>Full Edit</span>
							</button>
							<div class="my-1 border-t border-border-color/20"></div>
							<button
								type="button"
								onclick={() => {
									isMenuOpen = false;
									isConfirmingDelete = true;
								}}
								class="w-full text-left px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 flex items-center gap-2.5 font-bold cursor-pointer transition-colors group"
								role="menuitem"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="square"
									stroke-linejoin="miter"
									class="h-3.5 w-3.5 shrink-0"
								>
									<polyline points="3 6 5 6 21 6" />
									<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
								</svg>
								<span>Delete Test</span>
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Title & Description (or Inline Rename) -->
		{#if isRenaming}
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSaveRename();
				}}
				class="mb-2 space-y-1.5 animate-slide-down"
			>
				<input
					type="text"
					bind:value={renameTitle}
					use:focusOnMount
					class="neo-input w-full text-sm font-bold p-1.5 bg-surface border-2 border-border-color"
					onkeydown={(e) => {
						if (e.key === 'Escape') isRenaming = false;
					}}
				/>
				<div class="flex items-center gap-1.5">
					<button
						type="submit"
						class="neo-btn neo-btn-primary text-[11px] py-1 px-2.5 font-bold cursor-pointer"
					>
						Save
					</button>
					<button
						type="button"
						onclick={() => (isRenaming = false)}
						class="neo-btn text-[11px] py-1 px-2 cursor-pointer"
					>
						Cancel
					</button>
				</div>
			</form>
		{:else}
			<h3 class="text-base sm:text-xl font-black text-text-primary leading-snug uppercase tracking-tight line-clamp-2 mb-2">
				{test.title}
			</h3>
		{/if}

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
					onmouseenter={() => app.tests.prefetchTestDocAssets(test.id)}
					onfocus={() => app.tests.prefetchTestDocAssets(test.id)}
					onclick={handleSelectPractice}
					class="neo-btn text-[11px] py-2.5 px-2 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25 font-bold truncate cursor-pointer"
					title="Start in Practice Mode"
				>
					🌿 Practice
				</button>
				<button
					type="button"
					onmouseenter={() => app.tests.prefetchTestDocAssets(test.id)}
					onfocus={() => app.tests.prefetchTestDocAssets(test.id)}
					onclick={handleSelectExam}
					class="neo-btn neo-btn-primary text-[11px] py-2.5 px-2 font-bold truncate cursor-pointer"
					title="Start Exam Simulation"
				>
					🎯 Exam Sim
				</button>
			</div>
		{:else}
			<button
				type="button"
				onmouseenter={() => {
					preloadCode(`/test/${test.id}`);
					app.tests.prefetchTestDocAssets(test.id);
				}}
				onfocus={() => {
					preloadCode(`/test/${test.id}`);
					app.tests.prefetchTestDocAssets(test.id);
				}}
				onclick={handleStartClick}
				class="neo-btn neo-btn-primary w-full text-xs py-2.5 cursor-pointer"
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

		<!-- Sub Actions: View Details & Delete -->
		<div class="flex items-center justify-between gap-1.5 sm:gap-2">
			<button
				type="button"
				onmouseenter={() => {
					preloadCode(`/test/${test.id}`);
					app.tests.prefetchTestDocAssets(test.id);
				}}
				onfocus={() => {
					preloadCode(`/test/${test.id}`);
					app.tests.prefetchTestDocAssets(test.id);
				}}
				onclick={() => app.modals.openDetails(test)}
				class="neo-btn text-xs py-2 px-3 flex-1 text-center font-bold truncate cursor-pointer"
			>
				View Details
			</button>

			{#if isConfirmingDelete}
				<div class="flex items-center gap-1">
					<button
						type="button"
						onclick={handleDelete}
						class="neo-btn neo-btn-danger text-xs py-2 px-3 font-bold cursor-pointer"
					>
						Confirm
					</button>
					<button
						type="button"
						onclick={() => (isConfirmingDelete = false)}
						class="neo-btn text-xs py-2 px-2 cursor-pointer"
						title="Cancel delete"
					>
						✕
					</button>
				</div>
			{:else}
				<button
					type="button"
					onclick={handleDelete}
					class="neo-btn text-xs py-2 px-3 text-rose-500 hover:bg-rose-600 hover:text-white shrink-0 cursor-pointer"
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
