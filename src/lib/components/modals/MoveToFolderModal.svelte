<script lang="ts">
import { untrack } from 'svelte';
import InlineFolderCreator from '$lib/components/common/InlineFolderCreator.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

let selectedFolderId = $state<string | null>(null);
let newFolderParentId = $state<string | null>(null);
let isCreatingFolder = $state(false);
let selectedTestIds = $state<string[]>([]);

const isOpen = $derived(app.modals.isMoveToFolderModalOpen);
const targetTests = $derived(app.modals.moveTargetTests);
const isSingle = $derived(targetTests.length === 1);
const currentFolderId = $derived(isSingle ? (targetTests[0]?.folderId ?? null) : undefined);

const rootPaperCount = $derived(app.folders.getTestIdsInFolder(null).length);

const isCurrentRoot = $derived(isSingle && currentFolderId === null);
const isSelectedRoot = $derived(selectedFolderId === null);

// Pre-select initial folder and initialize test selection checklist when modal opens
$effect(() => {
	if (isOpen) {
		untrack(() => {
			isCreatingFolder = false;
			selectedTestIds = targetTests.map((t) => t.id);
			if (isSingle) {
				// If test is currently in a folder, default to null (Root) or keep selection
				selectedFolderId = currentFolderId === null ? (app.folders.folders[0]?.id ?? null) : null;
			} else {
				selectedFolderId = app.folders.activeFolderId;
			}
		});
	}
});

function handleClose() {
	app.modals.closeMoveToFolder();
}

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === 'Escape' && isOpen) {
		if (isCreatingFolder) {
			isCreatingFolder = false;
			return;
		}
		handleClose();
	}
}

function toggleTestSelection(testId: string) {
	if (selectedTestIds.includes(testId)) {
		selectedTestIds = selectedTestIds.filter((id) => id !== testId);
	} else {
		selectedTestIds = [...selectedTestIds, testId];
	}
}

function toggleSelectAllTests() {
	if (selectedTestIds.length === targetTests.length) {
		selectedTestIds = [];
	} else {
		selectedTestIds = targetTests.map((t) => t.id);
	}
}

async function handleConfirmMove() {
	if (targetTests.length === 0) return;

	if (isSingle) {
		if (targetTests[0]) {
			await app.moveTestToFolder(targetTests[0].id, selectedFolderId);
		}
	} else {
		if (selectedTestIds.length > 0) {
			await app.bulkMoveTestsToFolder(selectedTestIds, selectedFolderId);
		}
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
							{isSingle ? 'Move Assessment Paper' : `Move Assessments`}
						</h2>
						<p class="font-mono text-xs text-text-muted truncate max-w-xs sm:max-w-sm">
							{isSingle
								? (targetTests[0]?.title ?? 'Moving paper')
								: `Moving ${selectedTestIds.length} of ${targetTests.length} selected papers`}
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

			<!-- Multiple Tests Checklist Selector (when targetTests > 1) -->
			{#if !isSingle && targetTests.length > 0}
				<div class="mb-3 p-2.5 bg-muted/20 border-2 border-border-color space-y-1.5 shrink-0">
					<div class="flex items-center justify-between text-[11px] font-mono">
						<span class="font-bold text-text-primary uppercase tracking-tight">
							Papers to Move ({selectedTestIds.length}/{targetTests.length})
						</span>
						<button
							type="button"
							onclick={toggleSelectAllTests}
							class="text-accent-contrast underline hover:opacity-80 cursor-pointer font-bold"
						>
							{selectedTestIds.length === targetTests.length ? 'Deselect All' : 'Select All'}
						</button>
					</div>

					<div class="space-y-1 max-h-32 overflow-y-auto pr-1 font-mono text-xs">
						{#each targetTests as test (test.id)}
							{@const isChecked = selectedTestIds.includes(test.id)}
							<label
								class={`flex items-center gap-2 p-1.5 border transition-all cursor-pointer select-none ${
									isChecked
										? 'bg-surface border-border-color shadow-[1px_1px_0px_var(--shadow-color)]'
										: 'bg-muted/30 border-border-color/40 text-text-muted'
								}`}
							>
								<input
									type="checkbox"
									checked={isChecked}
									onchange={() => toggleTestSelection(test.id)}
									class="accent-accent-contrast h-3.5 w-3.5 cursor-pointer"
								/>
								<span class="truncate flex-1 font-bold text-text-primary text-[11px]">
									{test.title}
								</span>
							</label>
						{/each}
					</div>
				</div>
			{/if}

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
				{#each app.folders.flattenedTree as { folder, depth, paperCount } (folder.id)}
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
					<div class="p-2.5 bg-muted/30 border-2 border-border-color font-mono text-xs animate-slide-down space-y-2">
						<div class="flex items-center justify-between">
							<span class="font-bold uppercase tracking-wider text-text-secondary text-[10px]">
								New Folder Details:
							</span>
							<button
								type="button"
								onclick={() => (isCreatingFolder = false)}
								class="text-text-muted hover:text-text-primary cursor-pointer"
								aria-label="Cancel folder creation"
							>
								✕
							</button>
						</div>

						<div class="flex items-center gap-1.5 font-mono text-[11px]">
							<label for="move-modal-new-folder-parent" class="text-text-muted shrink-0">Parent:</label>
							<select
								id="move-modal-new-folder-parent"
								bind:value={newFolderParentId}
								class="neo-input text-xs py-1 px-1.5 bg-surface flex-1 font-mono"
							>
								<option value={null}>🏠 [Root Level]</option>
								{#each app.folders.flattenedTree as row (row.folder.id)}
									<option value={row.folder.id}>{row.prefix}📁 {row.folder.name}</option>
								{/each}
							</select>
						</div>

						<InlineFolderCreator
							parentId={newFolderParentId}
							placeholder="Enter folder name..."
							buttonLabel="Create & Select"
							oncreated={(folder) => {
								selectedFolderId = folder.id;
								isCreatingFolder = false;
							}}
							oncancel={() => (isCreatingFolder = false)}
						/>
					</div>
				{:else}
					<button
						type="button"
						onclick={() => {
							isCreatingFolder = true;
							newFolderParentId = selectedFolderId;
						}}
						class="w-full neo-btn text-xs py-1.5 px-3 font-mono font-bold flex items-center justify-center gap-1.5 bg-surface hover:bg-muted cursor-pointer"
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
					disabled={isSingle ? selectedFolderId === currentFolderId : selectedTestIds.length === 0}
					class="neo-btn neo-btn-primary text-xs py-2 px-5 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isSingle ? 'Move Paper →' : `Move ${selectedTestIds.length} Papers →`}
				</button>
			</div>
		</div>
	</div>
{/if}
