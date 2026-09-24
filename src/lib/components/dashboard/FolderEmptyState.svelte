<script lang="ts">
import InlineFolderCreator from '$lib/components/common/InlineFolderCreator.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

let isCreatingSubfolder = $state(false);

const activeFolder = $derived(app.folders.activeFolder);

// Eligible tests that can be moved here (not already in this folder)
const eligibleTests = $derived(
	app.tests.tests.filter((t) => t.folderId !== app.folders.activeFolderId)
);

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
		<div class="max-w-xs mx-auto p-3 bg-muted/30 border-2 border-border-color animate-slide-down text-left">
			<InlineFolderCreator
				parentId={app.folders.activeFolderId}
				placeholder="Enter subfolder name..."
				buttonLabel="Create"
				oncreated={() => (isCreatingSubfolder = false)}
				oncancel={() => (isCreatingSubfolder = false)}
			/>
		</div>
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
			onclick={() => (isCreatingSubfolder = true)}
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
