<script lang="ts">
import { goto, preloadCode } from '$app/navigation';
import { clickOutside } from '$lib/actions/clickOutside';
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { TestItem } from '$lib/types/test';
import { formatDate } from '$lib/utils';

const { test }: { test: TestItem } = $props();
const app = getAppContext();

let isSelectingMode = $state(false);
let isConfirmingDelete = $state(false);
let isMenuOpen = $state(false);
let wasMenuOpen = false;
let isRenaming = $state(false);
let renameTitle = $state('');
let modeTimer: ReturnType<typeof setTimeout> | null = null;

const status = $derived(test.status || 'ready');
const activeJob = $derived(app.queue.getJobByTestId(test.id));
const folderObj = $derived(test.folderId ? app.folders.folderMap.get(test.folderId) : null);
const showFolderBadge = $derived(
	Boolean((app.filter.folderScope === 'all' || app.filter.searchQuery) && folderObj)
);

function focusOnMount(node: HTMLElement) {
	node.focus();
}

function handleStartClick() {
	if (status !== 'ready') return;
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
	if (activeJob) {
		app.queue.removeJob(activeJob.id);
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

function handleOpenMoveToFolder() {
	isMenuOpen = false;
	app.modals.openMoveToFolder(test);
}

function handleCancelIngestion() {
	isMenuOpen = false;
	if (activeJob) {
		app.queue.cancelJob(activeJob.id);
	} else {
		app.handleDeleteTest(test.id);
	}
	app.toast.show(`Ingestion cancelled for "${test.title}".`, 'info');
}

function handleRetry() {
	if (activeJob) {
		app.queue.retryJob(activeJob.id);
		app.toast.show(`Retrying ingestion for "${test.title}"...`, 'info');
	} else {
		app.toast.show('Source job record not found to retry automatically.', 'warning');
	}
}

function handleDragStart(e: DragEvent) {
	if (e.dataTransfer) {
		e.dataTransfer.setData('text/plain', test.id);
		e.dataTransfer.setData('application/x-testify-test-id', test.id);
		e.dataTransfer.effectAllowed = 'move';
	}
}
</script>

<article
	onmouseenter={() => {
		if (status === 'ready') {
			preloadCode(`/test/${test.id}`);
			app.tests.prefetchTestDocAssets(test.id);
		}
	}}
	class={`neo-box p-4 sm:p-6 flex flex-col justify-between group hover:-translate-y-1 transition-all relative ${
		status === 'error'
			? '!border-rose-500 shadow-[4px_4px_0px_#f43f5e] hover:shadow-[6px_6px_0px_#f43f5e]'
			: status === 'processing'
				? 'border-border-color shadow-[4px_4px_0px_var(--shadow-color)] hover:shadow-[6px_6px_0px_var(--shadow-color)]'
				: 'hover:shadow-[6px_6px_0px_var(--shadow-color)]'
	}`}
>
	<!-- Card Top Section -->
	<div>
		<!-- Badges, Drag Handle & Actions Row -->
		<div class="flex items-center justify-between gap-2 mb-3">
			<div class="flex flex-wrap items-center gap-1.5">
				<!-- Desktop Drag Handle (Hidden on touch/mobile) -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					draggable="true"
					ondragstart={handleDragStart}
					class="hidden sm:inline-flex items-center justify-center p-1 text-text-muted hover:text-text-primary hover:bg-muted/80 border border-transparent hover:border-border-color cursor-grab active:cursor-grabbing select-none"
					title="Drag to file into another folder"
					aria-label="Drag assessment to file into a folder"
				>
					<span class="text-sm font-mono leading-none">⠿</span>
				</div>

				<!-- Subject Badge -->
				<span class="neo-badge bg-accent-contrast text-accent-contrast-text">
					{app.subjects.getName(test.subjectId) || '?'}
				</span>

				<!-- Folder Badge (Shown when in 'All Folders' mode or during search) -->
				{#if showFolderBadge && folderObj}
					<span class="neo-badge bg-muted/80 text-text-primary border border-border-color">
						📁 {folderObj.name}
					</span>
				{/if}

				<!-- State Badges: Processing or Error -->
				{#if status === 'processing'}
					<span class="neo-badge bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50 animate-pulse font-black">
						⚙ INGESTING...
					</span>
				{:else if status === 'error'}
					<span class="neo-badge bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/50 font-black">
						✕ FAILED
					</span>
				{/if}
			</div>

			<div class="flex items-center gap-2 sm:gap-2.5 shrink-0">
				<span class="font-mono text-[11px] text-text-muted">
					{formatDate(test.createdAt)}
				</span>

				<!-- Three Dots Dropdown Menu -->
				<div class="relative test-card-menu-container">
					<button
						type="button"
						onpointerdown={() => {
							wasMenuOpen = isMenuOpen;
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								wasMenuOpen = isMenuOpen;
							}
						}}
						onclick={(e) => {
							e.stopPropagation();
							if (wasMenuOpen) {
								isMenuOpen = false;
							} else {
								isMenuOpen = true;
							}
						}}
						class={`flex h-7 w-7 items-center justify-center cursor-pointer transition-all ${
							isMenuOpen
								? 'border-2 border-border-color bg-accent-contrast text-accent-contrast-text shadow-[2px_2px_0px_var(--shadow-color)]'
								: 'border border-transparent bg-transparent text-text-muted hover:text-text-primary hover:bg-muted/70 hover:border-border-color hover:shadow-[2px_2px_0px_var(--shadow-color)]'
						}`}
						title="Options"
						aria-label="Test options menu"
						aria-haspopup="menu"
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
							use:clickOutside={() => (isMenuOpen = false)}
							onkeydown={(e) => {
								if (e.key === 'Escape') isMenuOpen = false;
							}}
							tabindex="-1"
							class="absolute right-0 top-full mt-1.5 z-30 w-48 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] py-1 font-mono text-xs animate-slide-down"
							role="menu"
						>
							{#if status === 'processing'}
								<!-- Processing Ingestion Menu Items -->
								<button
									type="button"
									onclick={handleCancelIngestion}
									class="w-full text-left px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 font-bold cursor-pointer transition-colors"
									role="menuitem"
								>
									<span>✕</span>
									<span>Cancel Ingestion</span>
								</button>
							{:else}
								<!-- Ready or Error Menu Items -->
								<button
									type="button"
									onclick={handleOpenMoveToFolder}
									class="w-full text-left px-3 py-2 text-text-primary hover:bg-muted/70 flex items-center gap-2.5 font-bold cursor-pointer transition-colors group"
									role="menuitem"
								>
									<span class="text-text-muted group-hover:text-text-primary">📁</span>
									<span>Move to Folder...</span>
								</button>

								{#if status === 'ready'}
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
										<span class="text-text-muted group-hover:text-text-primary">✨</span>
										<span>Generate Similar</span>
									</button>

									<button
										type="button"
										onclick={handleOpenEdit}
										class="w-full text-left px-3 py-2 text-text-primary hover:bg-muted/70 flex items-center gap-2.5 font-bold cursor-pointer transition-colors group"
										role="menuitem"
									>
										<span class="text-text-muted group-hover:text-text-primary">📝</span>
										<span>Full Edit</span>
									</button>
								{/if}

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
									<span>🗑️</span>
									<span>Delete Test</span>
								</button>
							{/if}
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
			<p class={`text-xs line-clamp-2 mb-3 sm:mb-4 ${status === 'error' ? 'text-rose-600 dark:text-rose-400 font-mono' : 'text-text-secondary'}`}>
				{test.description}
			</p>
		{/if}

		<!-- SPECIFIC REACTIVE STATE RENDERS -->
		{#if status === 'processing'}
			<!-- Ingestion Progress State -->
			<div class="my-4 p-3 bg-muted/40 border-2 border-border-color space-y-2">
				<div class="flex items-center justify-between font-mono text-[11px] font-bold">
					<span class="text-text-secondary truncate">
						{activeJob?.statusText || 'Ingesting document...'}
					</span>
					<span class="text-text-primary ml-2 shrink-0">
						{activeJob?.progress ?? 10}%
					</span>
				</div>
				<!-- Neo-brutalist Progress Bar -->
				<div class="w-full bg-surface border-2 border-border-color h-3 overflow-hidden">
					<div
						class="bg-accent-contrast h-full transition-all duration-300"
						style={`width: ${activeJob?.progress ?? 15}%`}
					></div>
				</div>
			</div>
		{:else if status === 'ready'}
			<!-- Normal Test Specs Grid -->
			<div class="grid grid-cols-3 gap-1.5 sm:gap-2 py-2.5 sm:py-3 border-y-2 border-border-color/20 my-3 font-mono text-xs">
				<div class="flex flex-col">
					<span class="text-[10px] text-text-muted uppercase">Duration</span>
					<span class="font-bold text-text-primary text-[11px] sm:text-xs truncate">
						{test.durationMinutes ? `${test.durationMinutes} Mins` : 'Untimed'}
					</span>
				</div>
				<div class="flex flex-col">
					<span class="text-[10px] text-text-muted uppercase">Questions</span>
					<span class="font-bold text-text-primary text-[11px] sm:text-xs">
						{test.questions?.length || 0} Qs
					</span>
				</div>
				<div class="flex flex-col">
					<span class="text-[10px] text-text-muted uppercase">Total Marks</span>
					<span class="font-bold text-text-primary text-[11px] sm:text-xs">
						{test.totalMarks} Pts
					</span>
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
		{/if}
	</div>

	<!-- Action Footer Buttons -->
	<div class="pt-2 border-t border-border-color/20 flex flex-col gap-2">
		{#if status === 'processing'}
			<!-- Ingesting: Disabled Primary CTA with Cancel -->
			<div class="flex items-center gap-2">
				<button
					type="button"
					disabled
					class="neo-btn w-full text-xs py-2.5 opacity-60 cursor-not-allowed font-mono font-bold"
				>
					⚙ Ingestion in Progress...
				</button>
				<button
					type="button"
					onclick={handleCancelIngestion}
					class="neo-btn text-xs py-2.5 px-3 text-rose-500 hover:bg-rose-500 hover:text-white shrink-0 cursor-pointer"
					title="Cancel Ingestion"
				>
					✕
				</button>
			</div>
		{:else if status === 'error'}
			<!-- Error State: Retry & Dismiss -->
			<div class="grid grid-cols-2 gap-2 animate-slide-down">
				<button
					type="button"
					onclick={handleRetry}
					class="neo-btn text-xs py-2.5 px-2 bg-accent-contrast text-accent-contrast-text font-bold truncate cursor-pointer"
					title="Retry Document Extraction"
				>
					↺ Retry
				</button>
				{#if isConfirmingDelete}
					<div class="flex items-center gap-1">
						<button
							type="button"
							onclick={handleDelete}
							class="neo-btn neo-btn-danger text-xs py-2.5 px-2 flex-1 font-bold truncate cursor-pointer"
							title="Confirm remove failed assessment"
						>
							Confirm
						</button>
						<button
							type="button"
							onclick={() => (isConfirmingDelete = false)}
							class="neo-btn text-xs py-2.5 px-2 shrink-0 cursor-pointer"
							title="Cancel remove"
						>
							✕
						</button>
					</div>
				{:else}
					<button
						type="button"
						onclick={handleDelete}
						class="neo-btn neo-btn-danger text-xs py-2.5 px-2 font-bold truncate cursor-pointer"
						title="Dismiss and remove failed assessment"
					>
						🗑 Remove
					</button>
				{/if}
			</div>
		{:else}
			<!-- Ready State: Start Test / Mode Selector Slot -->
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
		{/if}
	</div>
</article>
