<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { FolderItem } from '$lib/types/folder';

const app = getAppContext();

let selectedFolderId = $state<string | null>(null);
let isCreatingFolder = $state(false);
let newFolderName = $state('');
let newFolderParentId = $state<string | null>(null);
let createError = $state('');

const isOpen = $derived(app.modals.isMoveToFolderModalOpen);
const targetTests = $derived(app.modals.moveTargetTests);
const isSingle = $derived(targetTests.length === 1);
const currentFolderId = $derived(isSingle ? targetTests[0]?.folderId ?? null : undefined);

// Build flattened tree with depth levels for clean hierarchical display
interface FlattenedFolder {
	folder: FolderItem;
	depth: number;
	paperCount: number;
}

const flattenedFolders = $derived.by<FlattenedFolder[]>(() => {
	const result: FlattenedFolder[] = [];
	const visited = new Set<string>();

	function traverse(parentId: string | null, depth: number) {
		const children = app.folders.folders
			.filter((f) => f.parentFolderId === parentId)
			.sort((a, b) => a.order - b.order);

		for (const child of children) {
			if (visited.has(child.id)) continue;
			visited.add(child.id);

			const paperCount = app.tests.tests.filter((t) => t.folderId === child.id).length;
			result.push({ folder: child, depth, paperCount });
			traverse(child.id, depth + 1);
		}
	}

	traverse(null, 0);
	return result;
});

const rootPaperCount = $derived(
	app.tests.tests.filter((t) => !t.folderId || t.folderId === null).length
);

const isCurrentRoot = $derived(isSingle && currentFolderId === null);
const isSelectedRoot = $derived(selectedFolderId === null);

// Pre-select initial folder when modal opens
$effect(() => {
	if (isOpen) {
		isCreatingFolder = false;
		newFolderName = '';
		createError = '';
		if (isSingle) {
			// If test is currently in a folder, default to null (Root) or keep selection
			selectedFolderId = currentFolderId === null ? (app.folders.folders[0]?.id ?? null) : null;
		} else {
			selectedFolderId = app.folders.activeFolderId;
		}
	}
});

function handleClose() {
	app.modals.closeMoveToFolder();
}

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === 'Escape' && isOpen) {
		if (isCreatingFolder) {
			isCreatingFolder = false;
			createError = '';
			return;
		}
		handleClose();
	}
}

async function handleInlineCreate(e?: Event) {
	e?.preventDefault();
	createError = '';
	const trimmed = newFolderName.trim();
	if (!trimmed) {
		createError = 'Folder name cannot be empty';
		return;
	}

	try {
		const created = await app.folders.addFolder(trimmed, newFolderParentId);
		app.toast.show(`Folder "${created.name}" created!`, 'success');
		selectedFolderId = created.id;
		isCreatingFolder = false;
		newFolderName = '';
	} catch (err) {
		createError = err instanceof Error ? err.message : 'Failed to create folder';
	}
}

async function handleConfirmMove() {
	if (targetTests.length === 0) return;

	if (isSingle) {
		await app.moveTestToFolder(targetTests[0].id, selectedFolderId);
	} else {
		const testIds = targetTests.map((t) => t.id);
		await app.bulkMoveTestsToFolder(testIds, selectedFolderId);
	}
	app.modals.closeMoveToFolder();
}
</script>

<svelte:window onkeydown={isOpen ? handleKeyDown : undefined} />

{#if isOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-xs animate-fade-in"
		onclick={(e) => {
			if (e.target === e.currentTarget) handleClose();
		}}
		role="presentation"
	>
		<!-- Modal Box -->
		<div
			class="neo-box-lg w-full max-w-lg bg-surface p-4 sm:p-6 animate-slide-down max-h-[90vh] flex flex-col border-2 border-border-color shadow-[6px_6px_0px_var(--shadow-color)]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="move-folder-modal-title"
		>
			<!-- Header -->
			<div class="flex items-start justify-between border-b-2 border-border-color pb-3 mb-4 shrink-0">
				<div class="flex items-center gap-2.5">
					<div class="flex h-8 w-8 items-center justify-center border-2 border-border-color bg-accent-contrast text-accent-contrast-text text-sm font-bold shadow-[2px_2px_0px_var(--shadow-color)]">
						📁
					</div>
					<div>
						<h2 id="move-folder-modal-title" class="text-base sm:text-lg font-black uppercase tracking-tight text-text-primary">
							{isSingle ? 'Move Assessment Paper' : `Move ${targetTests.length} Assessments`}
						</h2>
						<p class="font-mono text-xs text-text-muted truncate max-w-xs sm:max-w-sm">
							{isSingle ? targetTests[0]?.title : `Moving multiple selected papers`}
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

			<!-- Folder Tree List (Scrollable Area) -->
			<div class="space-y-1.5 overflow-y-auto flex-1 pr-1 py-1 font-mono text-xs max-h-[46vh]">
				<!-- Root / Unfiled Option -->
				<button
					type="button"
					disabled={isCurrentRoot}
					onclick={() => (selectedFolderId = null)}
					class={`w-full text-left p-2.5 border-2 transition-all flex items-center justify-between cursor-pointer ${
						isCurrentRoot
							? 'bg-muted/40 border-border-color/40 text-text-muted cursor-not-allowed opacity-60'
							: isSelectedRoot
								? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)] font-bold'
								: 'bg-surface border-border-color hover:bg-muted/60 shadow-[2px_2px_0px_var(--shadow-color)]'
					}`}
				>
					<div class="flex items-center gap-2">
						<span>🏠</span>
						<span class="uppercase tracking-tight">[ Root / All Assessments ]</span>
						{#if isCurrentRoot}
							<span class="text-[10px] text-text-muted font-bold">(Current)</span>
						{/if}
					</div>
					<span class="neo-badge text-[10px] bg-muted/80 text-text-primary">
						{rootPaperCount} {rootPaperCount === 1 ? 'Paper' : 'Papers'}
					</span>
				</button>

				<!-- Hierarchical Folder Items -->
				{#each flattenedFolders as { folder, depth, paperCount } (folder.id)}
					{@const isCurrentThis = isSingle && currentFolderId === folder.id}
					{@const isSelectedThis = selectedFolderId === folder.id}

					<button
						type="button"
						disabled={isCurrentThis}
						onclick={() => (selectedFolderId = folder.id)}
						class={`w-full text-left p-2.5 border-2 transition-all flex items-center justify-between cursor-pointer ${
							isCurrentThis
								? 'bg-muted/40 border-border-color/40 text-text-muted cursor-not-allowed opacity-60'
								: isSelectedThis
									? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)] font-bold'
									: 'bg-surface border-border-color hover:bg-muted/60 shadow-[2px_2px_0px_var(--shadow-color)]'
						}`}
						style={`margin-left: ${depth * 16}px; width: calc(100% - ${depth * 16}px);`}
					>
						<div class="flex items-center gap-2 truncate">
							{#if depth > 0}
								<span class="text-text-muted">└</span>
							{/if}
							<span>📁</span>
							<span class="uppercase tracking-tight truncate">{folder.name}</span>
							{#if isCurrentThis}
								<span class="text-[10px] text-text-muted font-bold shrink-0">(Current)</span>
							{/if}
						</div>

						<span class="neo-badge text-[10px] bg-muted/80 text-text-primary shrink-0">
							{paperCount} {paperCount === 1 ? 'Paper' : 'Papers'}
						</span>
					</button>
				{/each}
			</div>

			<!-- Inline "+ Create New Folder" Section (No modal-on-modal stacking) -->
			<div class="mt-3 pt-3 border-t-2 border-border-color/20 shrink-0">
				{#if isCreatingFolder}
					<form
						onsubmit={handleInlineCreate}
						class="space-y-2 p-2.5 bg-muted/30 border-2 border-border-color font-mono text-xs animate-slide-down"
					>
						<div class="flex items-center justify-between">
							<span class="font-bold uppercase tracking-wider text-text-secondary text-[10px]">
								New Folder Details:
							</span>
							<button
								type="button"
								onclick={() => (isCreatingFolder = false)}
								class="text-text-muted hover:text-text-primary cursor-pointer"
							>
								✕
							</button>
						</div>

						<input
							type="text"
							bind:value={newFolderName}
							placeholder="Enter folder name..."
							class="neo-input w-full text-xs font-bold py-1 px-2 bg-surface"
							required
						/>

						<div class="flex items-center gap-2">
							<label for="modal-new-folder-parent" class="text-[10px] text-text-muted uppercase shrink-0">Parent:</label>
							<select
								id="modal-new-folder-parent"
								bind:value={newFolderParentId}
								class="neo-input text-xs py-1 px-1.5 bg-surface flex-1"
							>
								<option value={null}>🏠 [Root]</option>
								{#each app.folders.folders as f (f.id)}
									<option value={f.id}>📁 {f.name}</option>
								{/each}
							</select>
						</div>

						{#if createError}
							<p class="text-[10px] font-bold text-rose-600 dark:text-rose-400">
								{createError}
							</p>
						{/if}

						<div class="flex items-center justify-end gap-1.5 pt-1">
							<button
								type="submit"
								class="neo-btn neo-btn-primary text-xs py-1 px-3 font-bold cursor-pointer"
							>
								Create & Select
							</button>
							<button
								type="button"
								onclick={() => (isCreatingFolder = false)}
								class="neo-btn text-xs py-1 px-2 cursor-pointer"
							>
								Cancel
							</button>
						</div>
					</form>
				{:else}
					<button
						type="button"
						onclick={() => {
							isCreatingFolder = true;
							newFolderParentId = selectedFolderId;
						}}
						class="w-full neo-btn text-xs py-1.5 px-3 font-mono font-bold flex items-center justify-center gap-1.5 bg-surface hover:bg-muted"
					>
						<span>+</span>
						<span>Create New Folder</span>
					</button>
				{/if}
			</div>

			<!-- Footer CTA -->
			<div class="flex items-center justify-between gap-3 pt-4 border-t-2 border-border-color mt-3 shrink-0">
				<button
					type="button"
					onclick={handleClose}
					class="neo-btn text-xs py-2 px-4 cursor-pointer"
				>
					Cancel
				</button>

				<button
					type="button"
					onclick={handleConfirmMove}
					disabled={isSingle && selectedFolderId === currentFolderId}
					class="neo-btn neo-btn-primary text-xs py-2 px-5 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isSingle ? 'Move Paper →' : `Move ${targetTests.length} Papers →`}
				</button>
			</div>
		</div>
	</div>
{/if}
