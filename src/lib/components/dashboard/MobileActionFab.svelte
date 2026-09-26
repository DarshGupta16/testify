<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

let isOpen = $state(false);
let isCreatingFolder = $state(false);
let newFolderName = $state('');
let folderError = $state('');
let isSubmittingFolder = $state(false);

function toggleMenu() {
	isOpen = !isOpen;
	if (!isOpen) {
		isCreatingFolder = false;
		newFolderName = '';
		folderError = '';
	}
}

function closeMenu() {
	isOpen = false;
	isCreatingFolder = false;
	newFolderName = '';
	folderError = '';
}

function handleKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape' && isOpen) {
		closeMenu();
	}
}

function handleUploadClick() {
	closeMenu();
	app.modals.openUpload();
}

function startFolderCreation() {
	isCreatingFolder = true;
	newFolderName = '';
	folderError = '';
}

async function handleCreateFolderSubmit(e: SubmitEvent) {
	e.preventDefault();
	folderError = '';
	const trimmed = newFolderName.trim();
	if (!trimmed) {
		folderError = 'Folder name cannot be empty';
		return;
	}

	isSubmittingFolder = true;
	try {
		const created = await app.folders.addFolder(trimmed, app.folders.activeFolderId);
		app.toast.show(`Folder "${created.name}" created!`, 'success');
		closeMenu();
	} catch (err) {
		folderError = err instanceof Error ? err.message : 'Failed to create folder';
	} finally {
		isSubmittingFolder = false;
	}
}

function autofocus(node: HTMLInputElement) {
	node.focus();
}
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- Strictly Mobile FAB Container (< sm) -->
<div class="fixed bottom-5 right-5 z-40 sm:hidden font-mono">
	<!-- Backdrop Overlay when Menu is Open -->
	{#if isOpen}
		<button
			type="button"
			tabindex="-1"
			aria-hidden="true"
			class="fixed inset-0 z-30 bg-black/25 backdrop-blur-[1px] cursor-default transition-opacity"
			onclick={closeMenu}
		></button>

		<!-- Speed-Dial Popover Menu -->
		<div
			class="neo-box absolute bottom-16 right-0 z-40 w-64 bg-surface border-2 border-border-color shadow-[5px_5px_0px_var(--shadow-color)] p-3 space-y-2 animate-slide-down text-left"
		>
			{#if !isCreatingFolder}
				<!-- Header Label -->
				<div class="flex items-center justify-between border-b-2 border-border-color pb-1.5">
					<span class="text-[10px] font-black uppercase tracking-wider text-text-muted">
						Quick Actions
					</span>
					<span class="text-[9px] font-bold text-text-muted">
						{app.folders.activeFolder ? app.folders.activeFolder.name : 'Root'}
					</span>
				</div>

				<!-- Action 1: Upload Test PDF -->
				<button
					type="button"
					onclick={handleUploadClick}
					class="neo-btn w-full py-2 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2.5 bg-accent-contrast text-accent-contrast-text border-2 border-border-color shadow-[2px_2px_0px_var(--shadow-color)] cursor-pointer"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="square"
						class="h-4 w-4 shrink-0"
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="17 8 12 3 7 8" />
						<line x1="12" y1="3" x2="12" y2="15" />
					</svg>
					<span>Upload Test PDF</span>
				</button>

				<!-- Action 2: Create New Folder -->
				<button
					type="button"
					onclick={startFolderCreation}
					class="neo-btn w-full py-2 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2.5 bg-surface hover:bg-muted text-text-primary border-2 border-border-color shadow-[2px_2px_0px_var(--shadow-color)] cursor-pointer"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="h-4 w-4 shrink-0"
					>
						<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
						<line x1="12" y1="10" x2="12" y2="16" />
						<line x1="9" y1="13" x2="15" y2="13" />
					</svg>
					<span>New Folder</span>
				</button>
			{:else}
				<!-- Inline New Folder Form on Mobile -->
				<form onsubmit={handleCreateFolderSubmit} class="space-y-2">
					<div class="flex items-center justify-between border-b-2 border-border-color pb-1">
						<span class="text-[10px] font-black uppercase tracking-wider text-text-primary">
							Create New Folder
						</span>
						<span class="text-[9px] text-text-muted truncate max-w-[120px]">
							in {app.folders.activeFolder ? app.folders.activeFolder.name : 'Root'}
						</span>
					</div>

					<input
						use:autofocus
						type="text"
						bind:value={newFolderName}
						oninput={() => {
							if (folderError) folderError = '';
						}}
						placeholder="Folder name..."
						disabled={isSubmittingFolder}
						class="neo-input w-full text-xs font-bold py-1.5 px-2 bg-surface border-2 border-border-color"
					/>

					{#if folderError}
						<p class="text-[10px] font-bold text-rose-600 dark:text-rose-400">
							{folderError}
						</p>
					{/if}

					<div class="flex items-center gap-1.5 pt-0.5">
						<button
							type="submit"
							disabled={isSubmittingFolder}
							class="neo-btn neo-btn-primary flex-1 py-1.5 px-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 cursor-pointer"
						>
							{isSubmittingFolder ? 'Creating...' : 'Create'}
						</button>
						<button
							type="button"
							onclick={() => {
								isCreatingFolder = false;
								newFolderName = '';
								folderError = '';
							}}
							disabled={isSubmittingFolder}
							class="neo-btn py-1.5 px-2 text-xs font-bold uppercase tracking-wider text-text-muted hover:text-text-primary cursor-pointer"
						>
							Back
						</button>
					</div>
				</form>
			{/if}
		</div>
	{/if}

	<!-- Primary Floating Plus Button -->
	<button
		type="button"
		onclick={toggleMenu}
		class="relative z-40 h-13 w-13 flex items-center justify-center border-2 border-border-color bg-accent-contrast text-accent-contrast-text shadow-[4px_4px_0px_var(--shadow-color)] transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-color"
		aria-label={isOpen ? 'Close mobile menu' : 'Open mobile quick actions'}
		aria-expanded={isOpen}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="3"
			stroke-linecap="square"
			class="h-6 w-6 transition-transform duration-200 {isOpen ? 'rotate-45' : ''}"
		>
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
	</button>
</div>
