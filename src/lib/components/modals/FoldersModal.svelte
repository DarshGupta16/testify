<script lang="ts">
import InlineFolderCreator from '$lib/components/common/InlineFolderCreator.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { FolderItem } from '$lib/types/folder';

const app = getAppContext();

// New Folder parent selection
let newFolderParentId = $state<string | null>(null);

// Inline Rename state
let editingFolderId = $state<string | null>(null);
let editingName = $state('');
let editError = $state('');

// Deletion confirmation state
let confirmingDeleteFolder = $state<FolderItem | null>(null);
let dontAskAgain = $state(false);

// Safety preference: always confirm before folder deletion (synced with app store)
const confirmFolderDelete = $derived(app.confirmFolderDelete);

function handleClose() {
	app.modals.closeFolders();
	editingFolderId = null;
	editingName = '';
	editError = '';
	confirmingDeleteFolder = null;
}

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === 'Escape' && app.modals.isFoldersModalOpen) {
		if (confirmingDeleteFolder) {
			confirmingDeleteFolder = null;
		} else if (editingFolderId) {
			editingFolderId = null;
		} else {
			handleClose();
		}
	}
}

function startEditing(folder: FolderItem) {
	editingFolderId = folder.id;
	editingName = folder.name;
	editError = '';
	confirmingDeleteFolder = null;
}

function cancelEditing() {
	editingFolderId = null;
	editingName = '';
	editError = '';
}

async function saveEditing(id: string) {
	editError = '';
	const trimmed = editingName.trim();
	if (!trimmed) {
		editError = 'Folder name cannot be empty.';
		return;
	}

	try {
		const updated = await app.folders.updateFolder(id, { name: trimmed });
		app.toast.show(`Folder renamed to "${updated.name}".`, 'success');
		editingFolderId = null;
		editingName = '';
	} catch (err) {
		editError = err instanceof Error ? err.message : 'Failed to rename folder.';
	}
}

function handleDeleteClick(folder: FolderItem) {
	editingFolderId = null;
	if (confirmFolderDelete) {
		dontAskAgain = false;
		confirmingDeleteFolder = folder;
	} else {
		app.deleteFolder(folder.id);
	}
}

async function handleConfirmDelete() {
	if (!confirmingDeleteFolder) return;

	if (dontAskAgain) {
		app.setConfirmFolderDelete(false);
	}

	const idToDelete = confirmingDeleteFolder.id;
	confirmingDeleteFolder = null;
	await app.deleteFolder(idToDelete);
}

function handleToggleSafetyPreference(checked: boolean) {
	app.setConfirmFolderDelete(checked);
}

// Count of papers affected by deleting the confirming folder
const deleteImpact = $derived.by(() => {
	if (!confirmingDeleteFolder) return { papers: 0, subfolders: 0 };
	const descendantIds = app.folders.getDescendantIds(confirmingDeleteFolder.id);
	const allIds = [confirmingDeleteFolder.id, ...descendantIds];
	const papers = allIds.reduce((sum, fid) => sum + app.folders.getTestIdsInFolder(fid).length, 0);
	return { papers, subfolders: descendantIds.length };
});
</script>

<svelte:window onkeydown={app.modals.isFoldersModalOpen ? handleKeyDown : undefined} />

{#if app.modals.isFoldersModalOpen}
	<!-- Modal Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-xs animate-fade-in"
		onclick={(e) => {
			if (e.target === e.currentTarget) handleClose();
		}}
		role="presentation"
	>
		<!-- Modal Content Box -->
		<div
			class="neo-box-lg w-full max-w-2xl bg-surface p-4 sm:p-7 animate-slide-down max-h-[92vh] flex flex-col border-2 border-border-color shadow-[6px_6px_0px_var(--shadow-color)]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="folders-modal-title"
		>
			<!-- Header -->
			<div class="flex items-start justify-between border-b-2 border-border-color pb-3 sm:pb-4 mb-4 shrink-0">
				<div class="flex items-center gap-2.5 sm:gap-3">
					<div class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center border-2 border-border-color bg-accent-contrast text-accent-contrast-text text-base font-bold shadow-[2px_2px_0px_var(--shadow-color)]">
						📁
					</div>
					<div>
						<h2 id="folders-modal-title" class="text-base sm:text-xl font-black uppercase tracking-tight text-text-primary">
							Manage Folders
						</h2>
						<p class="font-mono text-xs text-text-muted">
							Organize assessments into hierarchical folders and subfolders
						</p>
					</div>
				</div>

				<button
					type="button"
					onclick={handleClose}
					class="p-1 font-mono text-sm text-text-muted hover:text-text-primary cursor-pointer"
					aria-label="Close dialog"
				>
					✕
				</button>
			</div>

			<!-- Add New Folder Form -->
			<div class="space-y-2 mb-4 p-3 bg-muted/40 border-2 border-border-color shrink-0">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
					<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
						+ Create New Folder
					</span>
					<div class="flex items-center gap-1.5">
						<label for="folders-modal-parent-select" class="font-mono text-[11px] text-text-muted">Parent:</label>
						<select
							id="folders-modal-parent-select"
							bind:value={newFolderParentId}
							class="neo-input text-xs py-1 px-2 bg-surface font-mono"
						>
							<option value={null}>🏠 [Root Level]</option>
							{#each app.folders.flattenedTree as row (row.folder.id)}
								<option value={row.folder.id}>{row.prefix}📁 {row.folder.name}</option>
							{/each}
						</select>
					</div>
				</div>

				<InlineFolderCreator
					parentId={newFolderParentId}
					placeholder="Folder name (e.g. Physics, Midterms 2026)..."
					buttonLabel="Add Folder"
				/>
			</div>

			<!-- Folders List Area (Scrollable) -->
			<div class="space-y-2 overflow-y-auto flex-1 pr-1 font-mono text-xs max-h-[46vh]">
				{#if app.folders.flattenedTree.length === 0}
					<div class="p-6 text-center text-text-muted border-2 border-dashed border-border-color/60 bg-muted/20">
						No custom folders yet. Create your first folder above!
					</div>
				{:else}
					{#each app.folders.flattenedTree as { folder, depth, paperCount, subfolderCount } (folder.id)}
						<div
							class="neo-box p-2.5 bg-surface border-2 border-border-color shadow-[2px_2px_0px_var(--shadow-color)] flex items-center justify-between gap-2"
							style={`margin-left: ${Math.min(depth, 3) * 10}px; width: calc(100% - ${Math.min(depth, 3) * 10}px);`}
						>
							{#if editingFolderId === folder.id}
								<form
									onsubmit={(e) => {
										e.preventDefault();
										saveEditing(folder.id);
									}}
									class="flex items-center gap-2 flex-1"
								>
									<input
										type="text"
										bind:value={editingName}
										class="neo-input text-xs font-bold py-1 px-2 bg-surface flex-1"
									/>
									<button
										type="submit"
										class="neo-btn neo-btn-primary text-xs py-1 px-2.5 font-bold cursor-pointer"
									>
										Save
									</button>
									<button
										type="button"
										onclick={cancelEditing}
										class="neo-btn text-xs py-1 px-2 cursor-pointer"
									>
										Cancel
									</button>
								</form>
							{:else}
								<div class="flex items-center gap-2 truncate flex-1">
									{#if depth > 0}
										<span class="text-text-muted">└</span>
									{/if}
									<span>📁</span>
									<span class="font-bold text-text-primary uppercase tracking-tight truncate">
										{folder.name}
									</span>
									<span class="neo-badge text-[10px] bg-muted/60 text-text-secondary">
										{paperCount} {paperCount === 1 ? 'paper' : 'papers'}
									</span>
									{#if subfolderCount > 0}
										<span class="neo-badge text-[10px] bg-muted/40 text-text-muted">
											{subfolderCount} subfolders
										</span>
									{/if}
								</div>

								<div class="flex items-center gap-1 shrink-0">
									<button
										type="button"
										onclick={() => startEditing(folder)}
										class="min-h-[40px] min-w-[40px] p-2 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-muted font-bold cursor-pointer transition-colors"
										title="Rename folder"
										aria-label="Rename folder"
									>
										✏️
									</button>

									<button
										type="button"
										onclick={() => handleDeleteClick(folder)}
										class="min-h-[40px] min-w-[40px] p-2 flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 font-bold cursor-pointer transition-colors"
										title="Delete folder and contents"
										aria-label="Delete folder"
									>
										🗑️
									</button>
								</div>
							{/if}
						</div>

						{#if editingFolderId === folder.id && editError}
							<p class="text-[11px] font-mono text-rose-600 dark:text-rose-400 font-bold pl-2">
								{editError}
							</p>
						{/if}
					{/each}
				{/if}
			</div>

			<!-- Safety Toggle Footer -->
			<div class="mt-4 pt-3 border-t-2 border-border-color flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
				<label class="flex items-center gap-2 font-mono text-xs cursor-pointer select-none">
					<input
						type="checkbox"
						checked={confirmFolderDelete}
						onchange={(e) => handleToggleSafetyPreference(e.currentTarget.checked)}
						class="accent-accent-contrast h-4 w-4"
					/>
					<span class="text-text-secondary font-bold">
						Always ask before deleting folders and their contents
					</span>
				</label>

				<button
					type="button"
					onclick={handleClose}
					class="neo-btn text-xs py-1.5 px-4 font-bold cursor-pointer self-end sm:self-auto"
				>
					Done
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Deletion Confirmation Dialog Overlay -->
{#if confirmingDeleteFolder}
	<div
		class="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs animate-fade-in"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) confirmingDeleteFolder = null;
		}}
	>
		<div
			class="neo-box-lg w-full max-w-md bg-surface p-5 sm:p-6 animate-slide-down border-2 border-rose-500 shadow-[6px_6px_0px_var(--shadow-color)] space-y-4"
			role="alertdialog"
			aria-labelledby="confirm-delete-folder-title"
		>
			<div class="flex items-center gap-3 text-rose-600 dark:text-rose-400">
				<span class="text-2xl">⚠️</span>
				<h3 id="confirm-delete-folder-title" class="font-mono text-base font-black uppercase tracking-tight">
					Confirm Folder Deletion
				</h3>
			</div>

			<p class="text-xs text-text-primary leading-relaxed">
				Are you sure you want to delete <strong class="uppercase">"{confirmingDeleteFolder.name}"</strong>?
				This will permanently delete this folder{#if deleteImpact.subfolders > 0}, its {deleteImpact.subfolders} subfolders,{/if} and all <strong class="text-rose-600 dark:text-rose-400">{deleteImpact.papers} papers</strong> inside.
			</p>

			<label class="flex items-center gap-2 font-mono text-xs cursor-pointer select-none p-2 bg-muted/40 border border-border-color/50">
				<input
					type="checkbox"
					bind:checked={dontAskAgain}
					class="accent-accent-contrast h-4 w-4"
				/>
				<span class="text-text-secondary font-bold">
					Don't ask me again
				</span>
			</label>

			<div class="flex items-center justify-end gap-2 pt-2">
				<button
					type="button"
					onclick={() => (confirmingDeleteFolder = null)}
					class="neo-btn text-xs py-2 px-3 font-bold cursor-pointer"
				>
					Cancel
				</button>

				<button
					type="button"
					onclick={handleConfirmDelete}
					class="neo-btn neo-btn-danger text-xs py-2 px-4 font-bold cursor-pointer"
				>
					Delete Folder & Papers
				</button>
			</div>
		</div>
	</div>
{/if}
