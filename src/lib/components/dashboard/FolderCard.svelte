<script lang="ts">
import { goto } from '$app/navigation';
import { clickOutside } from '$lib/actions/clickOutside';
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { FolderItem } from '$lib/types/folder';

const { folder }: { folder: FolderItem } = $props();
const app = getAppContext();

let isMenuOpen = $state(false);
let wasMenuOpen = false;
let isRenaming = $state(false);
let renameName = $state('');
let isMovingFolder = $state(false);
let selectedNewParentId = $state<string | null>(null);
let isDragOver = $state(false);
let isConfirmingDelete = $state(false);

$effect(() => {
	selectedNewParentId = folder.parentFolderId ?? null;
});
let renameInputRef = $state<HTMLInputElement | null>(null);

const paperCount = $derived(
	app.tests.tests.filter((t) => t.folderId === folder.id).length
);

const subfolderCount = $derived(
	app.folders.folders.filter((f) => f.parentFolderId === folder.id).length
);

// Potential destination folders for moving this folder (cannot move into self or descendants)
const validMoveDestinations = $derived.by(() => {
	const descendants = new Set(app.folders.getDescendantIds(folder.id));
	descendants.add(folder.id);
	return app.folders.folders.filter((f) => !descendants.has(f.id));
});

function handleOpenFolder() {
	if (isRenaming || isMovingFolder || isConfirmingDelete) return;
	app.folders.setActiveFolder(folder.id);
	goto(`?folder=${folder.id}`);
}

function handleStartRename(e: Event) {
	e.stopPropagation();
	renameName = folder.name;
	isRenaming = true;
	isMenuOpen = false;
	setTimeout(() => {
		renameInputRef?.focus();
	}, 50);
}

async function handleSaveRename(e?: Event) {
	e?.preventDefault();
	e?.stopPropagation();
	const trimmed = renameName.trim();
	if (!trimmed) {
		app.toast.show('Folder name cannot be empty', 'warning');
		return;
	}

	if (trimmed !== folder.name) {
		try {
			await app.folders.updateFolder(folder.id, { name: trimmed });
			app.toast.show(`Folder renamed to "${trimmed}".`, 'success');
		} catch (err) {
			app.toast.show(err instanceof Error ? err.message : 'Rename failed', 'error');
		}
	}
	isRenaming = false;
}

function handleCancelRename(e: Event) {
	e.stopPropagation();
	isRenaming = false;
}

async function handleConfirmMoveFolder(e: Event) {
	e.stopPropagation();
	try {
		await app.folders.moveFolder(folder.id, selectedNewParentId);
		const targetName = selectedNewParentId
			? app.folders.folderMap.get(selectedNewParentId)?.name ?? 'Folder'
			: 'Root';
		app.toast.show(`Moved folder "${folder.name}" to ${targetName}.`, 'success');
		isMovingFolder = false;
	} catch (err) {
		app.toast.show(err instanceof Error ? err.message : 'Failed to move folder', 'error');
	}
}

async function handleDeleteFolder(e: Event) {
	e.stopPropagation();
	isMenuOpen = false;
	if (app.confirmFolderDelete && !isConfirmingDelete) {
		isConfirmingDelete = true;
		return;
	}
	isConfirmingDelete = false;
	await app.deleteFolder(folder.id);
}

function handleDragOver(e: DragEvent) {
	if (e.dataTransfer?.types.includes('application/x-testify-test-id')) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		isDragOver = true;
	}
}

function handleDragLeave() {
	isDragOver = false;
}

async function handleDrop(e: DragEvent) {
	e.preventDefault();
	e.stopPropagation();
	isDragOver = false;

	const testId =
		e.dataTransfer?.getData('application/x-testify-test-id') ||
		e.dataTransfer?.getData('text/plain');

	if (testId) {
		await app.moveTestToFolder(testId, folder.id);
	}
}
</script>

<div class="relative group">
	<!-- Manila Tab Motif extending above the card -->
	<div class="flex items-center">
		<div
			class={`inline-flex items-center gap-1.5 px-3 py-1 border-t-2 border-x-2 font-mono text-[10px] font-bold uppercase select-none transition-colors ${
				isDragOver
					? 'bg-amber-500 text-white border-amber-600'
					: 'bg-muted/80 text-text-secondary border-border-color group-hover:bg-muted group-hover:text-text-primary'
			}`}
			style="clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 100%, 0 100%); margin-bottom: -2px; padding-right: 1.25rem;"
		>
			<span class="text-xs">📁</span>
			<span>Folder</span>
		</div>
	</div>

	<!-- Main Tactile Card -->
	<article
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		class={`neo-box p-4 bg-surface flex flex-col justify-between select-none transition-all relative ${
			isDragOver
				? '!bg-accent-contrast/10 !border-accent-contrast ring-2 ring-accent-contrast shadow-[6px_6px_0px_var(--shadow-color)]'
				: 'hover:-translate-y-1 hover:shadow-[6px_6px_0px_var(--shadow-color)]'
		}`}
	>
		{#if !isRenaming && !isMovingFolder && !isConfirmingDelete}
			<!-- Full-card overlay hitbox so clicking empty card areas navigates into folder -->
			<button
				type="button"
				onclick={handleOpenFolder}
				tabindex="-1"
				aria-hidden="true"
				class="absolute inset-0 z-0 w-full h-full cursor-pointer bg-transparent border-0 p-0 text-transparent select-none focus:outline-none"
			>
				Open {folder.name}
			</button>
		{/if}

		<!-- Card Top Row: Title & Options Menu -->
		<div class="relative z-10">
			<div class="flex items-start justify-between gap-2 mb-2">
				{#if isRenaming}
					<form
						onsubmit={handleSaveRename}
						class="flex-1 mr-2 space-y-1.5"
					>
						<input
							bind:this={renameInputRef}
							type="text"
							bind:value={renameName}
							onclick={(e) => e.stopPropagation()}
							class="neo-input w-full text-xs font-bold py-1 px-2 bg-surface border-2 border-border-color"
							onkeydown={(e) => {
								if (e.key === 'Escape') handleCancelRename(e);
								else e.stopPropagation();
							}}
						/>
						<div class="flex items-center gap-1.5">
							<button
								type="submit"
								class="neo-btn neo-btn-primary text-[10px] py-1 px-2 font-bold cursor-pointer"
							>
								Save
							</button>
							<button
								type="button"
								onclick={handleCancelRename}
								class="neo-btn text-[10px] py-1 px-1.5 cursor-pointer"
							>
								✕
							</button>
						</div>
					</form>
				{:else}
					<button
						type="button"
						onclick={handleOpenFolder}
						class="text-left group/title flex-1 min-w-0 focus-visible:outline-2 focus-visible:outline-accent-contrast transition-colors cursor-pointer"
						aria-label={`Open folder ${folder.name}`}
					>
						<h3 class="text-base sm:text-lg font-black uppercase tracking-tight text-text-primary group-hover/title:text-accent-contrast transition-colors truncate">
							{folder.name}
						</h3>
					</button>
				{/if}

				<!-- 3-Dots Action Menu with Decoupled Hitbox -->
				<div class="relative shrink-0">
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
							isMenuOpen = !wasMenuOpen;
						}}
						class={`flex h-7 w-7 items-center justify-center cursor-pointer transition-all ${
							isMenuOpen
								? 'border-2 border-border-color bg-accent-contrast text-accent-contrast-text shadow-[2px_2px_0px_var(--shadow-color)]'
								: 'border border-transparent bg-transparent text-text-muted hover:text-text-primary hover:bg-muted/70 hover:border-border-color hover:shadow-[2px_2px_0px_var(--shadow-color)]'
						}`}
						title="Folder options"
						aria-label="Folder options menu"
						aria-haspopup="menu"
						aria-expanded={isMenuOpen}
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4">
							<circle cx="12" cy="5" r="1.75" />
							<circle cx="12" cy="12" r="1.75" />
							<circle cx="12" cy="19" r="1.75" />
						</svg>
					</button>

					{#if isMenuOpen}
						<div
							use:clickOutside={() => (isMenuOpen = false)}
							onclick={(e) => e.stopPropagation()}
							onkeydown={(e) => {
								if (e.key === 'Escape') isMenuOpen = false;
								else e.stopPropagation();
							}}
							tabindex="-1"
							class="absolute right-0 top-full mt-1.5 z-30 w-44 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] py-1 font-mono text-xs animate-slide-down"
							role="menu"
						>
							<button
								type="button"
								onclick={handleStartRename}
								class="w-full text-left px-3 py-2 text-text-primary hover:bg-muted/70 flex items-center gap-2 font-bold cursor-pointer transition-colors"
								role="menuitem"
							>
								<span>✏️</span>
								<span>Rename</span>
							</button>

							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									isMovingFolder = true;
									isMenuOpen = false;
								}}
								class="w-full text-left px-3 py-2 text-text-primary hover:bg-muted/70 flex items-center gap-2 font-bold cursor-pointer transition-colors"
								role="menuitem"
							>
								<span>⇄</span>
								<span>Move to Folder...</span>
							</button>

							<div class="my-1 border-t border-border-color/20"></div>

							<button
								type="button"
								onclick={handleDeleteFolder}
								class="w-full text-left px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 font-bold cursor-pointer transition-colors"
								role="menuitem"
							>
								<span>🗑️</span>
								<span>Delete Folder</span>
							</button>
						</div>
					{/if}
				</div>
			</div>

			{#if folder.description}
				<p class="text-xs text-text-secondary line-clamp-2 mb-3">
					{folder.description}
				</p>
			{/if}
		</div>

		<!-- Move Folder Inline Picker Slot -->
		{#if isMovingFolder}
			<div class="relative z-10 my-2 p-2.5 bg-muted/40 border-2 border-border-color font-mono text-xs space-y-2 animate-slide-down">
				<label
					for="move-folder-select-{folder.id}"
					class="font-bold uppercase tracking-wider text-text-muted text-[10px] block"
				>
					Select Destination:
				</label>
				<select
					id="move-folder-select-{folder.id}"
					bind:value={selectedNewParentId}
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
					class="neo-input w-full text-xs py-1 px-2 bg-surface font-sans"
				>
					<option value={null}>🏠 [Root / All Assessments]</option>
					{#each validMoveDestinations as dest (dest.id)}
						<option value={dest.id} disabled={dest.id === folder.parentFolderId}>
							📁 {dest.name} {dest.id === folder.parentFolderId ? '(Current Parent)' : ''}
						</option>
					{/each}
				</select>
				<div class="flex items-center gap-1.5 justify-end">
					<button
						type="button"
						onclick={handleConfirmMoveFolder}
						class="neo-btn neo-btn-primary text-[10px] py-1 px-2.5 font-bold cursor-pointer"
					>
						Move
					</button>
					<button
						type="button"
						onclick={(e) => {
							e.stopPropagation();
							isMovingFolder = false;
						}}
						class="neo-btn text-[10px] py-1 px-2 cursor-pointer"
					>
						Cancel
					</button>
				</div>
			</div>
		{/if}

		<!-- Delete Confirmation Inline Slot -->
		{#if isConfirmingDelete}
			<div class="relative z-10 my-2 p-2.5 bg-rose-500/10 border-2 border-rose-500 font-mono text-xs space-y-2 animate-slide-down">
				<p class="font-bold text-rose-600 dark:text-rose-400 text-[11px] leading-tight">
					Delete folder "{folder.name}" and all assessments inside?
				</p>
				<div class="flex items-center gap-1.5 justify-end">
					<button
						type="button"
						onclick={async (e) => {
							e.stopPropagation();
							isConfirmingDelete = false;
							await app.deleteFolder(folder.id);
						}}
						class="neo-btn neo-btn-danger text-[10px] py-1 px-2.5 font-bold cursor-pointer"
					>
						Delete
					</button>
					<button
						type="button"
						onclick={(e) => {
							e.stopPropagation();
							isConfirmingDelete = false;
						}}
						class="neo-btn text-[10px] py-1 px-2 cursor-pointer"
					>
						Cancel
					</button>
				</div>
			</div>
		{/if}

		<!-- Badges Row: Papers and Subfolders -->
		<div class="relative z-10 flex flex-wrap items-center gap-2 pt-3 border-t-2 border-border-color/15 mt-3">
			<span class="neo-badge bg-surface font-bold text-[10px] border border-border-color">
				📄 {paperCount} {paperCount === 1 ? 'PAPER' : 'PAPERS'}
			</span>

			{#if subfolderCount > 0}
				<span class="neo-badge bg-muted/60 font-bold text-[10px] border border-border-color/60 text-text-secondary">
					📁 {subfolderCount} {subfolderCount === 1 ? 'SUBFOLDER' : 'SUBFOLDERS'}
				</span>
			{/if}

			{#if isDragOver}
				<span class="font-mono text-[10px] font-black text-amber-600 dark:text-amber-400 animate-pulse ml-auto">
					DROP TO MOVE
				</span>
			{/if}
		</div>
	</article>
</div>
