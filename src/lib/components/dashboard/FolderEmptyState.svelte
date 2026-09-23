<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

let isCreatingSubfolder = $state(false);
let subfolderName = $state('');
let subfolderError = $state('');
let subfolderInputRef = $state<HTMLInputElement | null>(null);

const activeFolder = $derived(app.folders.activeFolder);

// Eligible tests that can be moved here (not already in this folder)
const eligibleTests = $derived(
	app.tests.tests.filter((t) => t.folderId !== app.folders.activeFolderId)
);

function handleStartSubfolder() {
	isCreatingSubfolder = true;
	subfolderName = '';
	subfolderError = '';
	setTimeout(() => {
		subfolderInputRef?.focus();
	}, 50);
}

function handleCancelSubfolder() {
	isCreatingSubfolder = false;
	subfolderName = '';
	subfolderError = '';
}

async function handleSaveSubfolder(e?: Event) {
	e?.preventDefault();
	subfolderError = '';
	const trimmed = subfolderName.trim();
	if (!trimmed) {
		subfolderError = 'Subfolder name cannot be empty';
		return;
	}

	try {
		const created = await app.folders.addFolder(
			trimmed,
			app.folders.activeFolderId
		);
		app.toast.show(`Subfolder "${created.name}" created!`, 'success');
		isCreatingSubfolder = false;
		subfolderName = '';
	} catch (err) {
		subfolderError = err instanceof Error ? err.message : 'Failed to create subfolder';
	}
}

function handleMoveExisting() {
	if (eligibleTests.length === 0) {
		app.toast.show('No other tests available to move into this folder.', 'info');
		return;
	}
	app.modals.openMoveToFolder(eligibleTests);
}
</script>

<div class="neo-box p-8 sm:p-12 text-center bg-surface border-2 border-dashed border-border-color/80 my-8 space-y-5 max-w-2xl mx-auto shadow-[4px_4px_0px_var(--shadow-color)] animate-fade-in">
	<div class="mx-auto flex h-14 w-14 items-center justify-center border-2 border-border-color bg-muted text-2xl shadow-[3px_3px_0px_var(--shadow-color)]">
		📁
	</div>

	<div class="space-y-1.5">
		<h3 class="font-mono text-base sm:text-lg font-black uppercase text-text-primary tracking-tight">
			Folder "{activeFolder?.name || 'Current'}" is Empty
		</h3>
		<p class="text-xs sm:text-sm text-text-secondary max-w-md mx-auto">
			No assessment papers or subfolders have been filed here yet. Get started by uploading a PDF, creating a subfolder, or moving existing tests.
		</p>
	</div>

	{#if isCreatingSubfolder}
		<form
			onsubmit={handleSaveSubfolder}
			class="max-w-xs mx-auto space-y-2 p-3 bg-muted/30 border-2 border-border-color animate-slide-down"
		>
			<input
				bind:this={subfolderInputRef}
				type="text"
				bind:value={subfolderName}
				placeholder="Enter subfolder name..."
				class="neo-input w-full text-xs font-bold py-1.5 px-2 bg-surface"
				onkeydown={(e) => {
					if (e.key === 'Escape') handleCancelSubfolder();
				}}
			/>
			{#if subfolderError}
				<p class="text-[11px] font-mono text-rose-600 dark:text-rose-400 text-left font-bold">
					{subfolderError}
				</p>
			{/if}
			<div class="flex items-center gap-2 justify-end">
				<button
					type="submit"
					class="neo-btn neo-btn-primary text-xs py-1 px-3 font-bold cursor-pointer"
				>
					Create
				</button>
				<button
					type="button"
					onclick={handleCancelSubfolder}
					class="neo-btn text-xs py-1 px-2.5 cursor-pointer"
				>
					Cancel
				</button>
			</div>
		</form>
	{/if}

	<div class="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 pt-2">
		<button
			type="button"
			onclick={() => app.modals.openUpload()}
			class="neo-btn neo-btn-primary text-xs py-2 px-4 font-bold inline-flex items-center gap-1.5 cursor-pointer"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				class="h-3.5 w-3.5"
			>
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			<span>Upload Test PDF Here</span>
		</button>

		<button
			type="button"
			onclick={handleStartSubfolder}
			class="neo-btn text-xs py-2 px-3.5 font-bold inline-flex items-center gap-1.5 cursor-pointer bg-surface hover:bg-muted"
		>
			<span>+</span>
			<span>New Subfolder</span>
		</button>

		{#if eligibleTests.length > 0}
			<button
				type="button"
				onclick={handleMoveExisting}
				class="neo-btn text-xs py-2 px-3.5 font-bold inline-flex items-center gap-1.5 cursor-pointer bg-surface hover:bg-muted"
			>
				<span>⇄</span>
				<span>Move Existing Tests Here</span>
			</button>
		{/if}
	</div>
</div>
