<script lang="ts">
import { goto } from '$app/navigation';
import { clickOutside } from '$lib/actions/clickOutside';
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { FolderItem } from '$lib/types/folder';

const app = getAppContext();

// Inline new folder creation state
let isCreatingFolder = $state(false);
let newFolderName = $state('');
let createError = $state('');
let creationInputRef = $state<HTMLInputElement | null>(null);

// Sibling dropdown state: key is folder id or 'root'
let openSiblingDropdown = $state<string | null>(null);

// Drag & drop highlight state: folder id or 'root'
let activeDragTargetId = $state<string | null>(null);

// Ellipsis dropdown state for collapsed crumbs
let isEllipsisDropdownOpen = $state(false);

const activePath = $derived(app.folders.activeFolderPath);
const isRoot = $derived(!app.folders.activeFolderId);

// Responsive breadcrumbs: collapse when activePath is long
const shouldCollapse = $derived(activePath.length > 2);
const visibleCrumbs = $derived.by<{
	first?: FolderItem;
	collapsed: FolderItem[];
	tail: FolderItem[];
}>(() => {
	if (!shouldCollapse) {
		return {
			collapsed: [],
			tail: activePath,
		};
	}
	// Keep the first ancestor, collapse intermediate ones, keep the last 1 or 2
	const first = activePath[0];
	const collapsed = activePath.slice(1, activePath.length - 1);
	const tail = activePath.slice(activePath.length - 1);
	return { first, collapsed, tail };
});

function handleNavigate(folderId: string | null) {
	app.folders.setActiveFolder(folderId);
	if (folderId) {
		goto(`?folder=${folderId}`);
	} else {
		goto('/');
	}
}

function handleStartCreate() {
	isCreatingFolder = true;
	newFolderName = '';
	createError = '';
	setTimeout(() => {
		creationInputRef?.focus();
	}, 50);
}

function handleCancelCreate() {
	isCreatingFolder = false;
	newFolderName = '';
	createError = '';
}

async function handleSaveCreate(e?: Event) {
	e?.preventDefault();
	createError = '';
	const trimmed = newFolderName.trim();
	if (!trimmed) {
		createError = 'Folder name cannot be empty';
		return;
	}

	try {
		const created = await app.folders.addFolder(
			trimmed,
			app.folders.activeFolderId
		);
		app.toast.show(`Folder "${created.name}" created!`, 'success');
		isCreatingFolder = false;
		newFolderName = '';
	} catch (err) {
		createError = err instanceof Error ? err.message : 'Failed to create folder';
	}
}

function handleDragOver(e: DragEvent, targetId: string | null) {
	if (e.dataTransfer?.types.includes('application/x-testify-test-id')) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		activeDragTargetId = targetId ?? 'root';
	}
}

function handleDragLeave(targetId: string | null) {
	if (activeDragTargetId === (targetId ?? 'root')) {
		activeDragTargetId = null;
	}
}

async function handleDrop(e: DragEvent, targetFolderId: string | null) {
	e.preventDefault();
	activeDragTargetId = null;

	const testId =
		e.dataTransfer?.getData('application/x-testify-test-id') ||
		e.dataTransfer?.getData('text/plain');

	if (testId) {
		await app.moveTestToFolder(testId, targetFolderId);
	}
}

function getSiblings(folder: FolderItem): FolderItem[] {
	return app.folders.folders
		.filter((f) => f.parentFolderId === folder.parentFolderId && f.id !== folder.id)
		.sort((a, b) => a.order - b.order);
}

function getRootSiblings(): FolderItem[] {
	return app.folders.rootFolders;
}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			openSiblingDropdown = null;
			isEllipsisDropdownOpen = false;
		}
	}}
/>

<nav
	aria-label="Folder Breadcrumb Navigation"
	class="relative z-30 neo-box p-2.5 sm:p-3 bg-surface flex flex-col md:flex-row md:items-center justify-between gap-3 border-2 border-border-color"
>
	<!-- Left: Interactive Breadcrumb Trail -->
	<ol class="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-mono font-bold">
		<!-- Root Crumb (All Assessments) -->
		<li
			class={`relative flex items-center ${openSiblingDropdown === 'root' ? 'z-50' : ''}`}
			ondragover={(e) => handleDragOver(e, null)}
			ondragleave={() => handleDragLeave(null)}
			ondrop={(e) => handleDrop(e, null)}
		>
			<button
				type="button"
				onclick={() => handleNavigate(null)}
				class={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border-2 transition-all cursor-pointer select-none ${
					isRoot
						? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)]'
						: 'bg-muted/50 text-text-primary border-border-color hover:bg-muted shadow-[2px_2px_0px_var(--shadow-color)]'
				} ${activeDragTargetId === 'root' ? '!bg-amber-500/20 !border-amber-500 ring-2 ring-amber-400' : ''}`}
				title="Root / All Assessments (Drag paper here to move to root)"
			>
				<span class="text-sm">🏠</span>
				<span class="uppercase tracking-tight">All Assessments</span>
			</button>

			<!-- Root Siblings Dropdown (Quick hopping to other root folders) -->
			{#if app.folders.rootFolders.length > 0}
				<div class={`relative ml-0.5 ${openSiblingDropdown === 'root' ? 'z-50' : ''}`}>
					<button
						type="button"
						onclick={(e) => {
							e.stopPropagation();
							openSiblingDropdown = openSiblingDropdown === 'root' ? null : 'root';
						}}
						class="p-1 border border-border-color/60 bg-muted/30 hover:bg-muted hover:border-border-color text-text-muted hover:text-text-primary transition-colors cursor-pointer"
						title="Quick hop to root folders"
						aria-label="Hop to other root folders"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3">
							<path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
						</svg>
					</button>

					{#if openSiblingDropdown === 'root'}
						<div
							role="menu"
							use:clickOutside={() => (openSiblingDropdown = null)}
							onkeydown={(e) => {
								if (e.key === 'Escape') openSiblingDropdown = null;
							}}
							tabindex="-1"
							class="absolute left-0 top-full mt-1.5 z-50 w-48 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] py-1 font-mono text-xs animate-slide-down"
						>
							<div class="px-2.5 py-1 text-[10px] text-text-muted uppercase border-b border-border-color/20 font-bold">
								Root Folders
							</div>
							{#each getRootSiblings() as rootF (rootF.id)}
								<button
									type="button"
									role="menuitem"
									onclick={() => {
										openSiblingDropdown = null;
										handleNavigate(rootF.id);
									}}
									class={`w-full text-left px-3 py-1.5 hover:bg-muted/80 flex items-center gap-2 truncate cursor-pointer ${
										app.folders.activeFolderId === rootF.id ? 'font-black bg-muted/40' : ''
									}`}
								>
									<span>📁</span>
									<span class="truncate">{rootF.name}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</li>

		<!-- Separator if inside a folder -->
		{#if activePath.length > 0}
			<li class="text-text-muted font-bold select-none px-0.5">/</li>
		{/if}

		<!-- Collapsed Intermediate Crumbs (if path > 2) -->
		{#if shouldCollapse && visibleCrumbs.first}
			<!-- First Ancestor -->
			{@const first = visibleCrumbs.first}
			<li
				class="relative flex items-center"
				ondragover={(e) => handleDragOver(e, first.id)}
				ondragleave={() => handleDragLeave(first.id)}
				ondrop={(e) => handleDrop(e, first.id)}
			>
				<button
					type="button"
					onclick={() => handleNavigate(first.id)}
					class={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-border-color bg-muted/40 hover:bg-muted shadow-[2px_2px_0px_var(--shadow-color)] transition-all cursor-pointer ${
						activeDragTargetId === first.id ? '!bg-amber-500/20 !border-amber-500 ring-2 ring-amber-400' : ''
					}`}
					title={first.name}
				>
					<span>📁</span>
					<span class="max-w-[120px] truncate uppercase">{first.name}</span>
				</button>
			</li>

			<li class="text-text-muted font-bold select-none px-0.5">/</li>

			<!-- Ellipsis Button with Dropdown -->
			<li class={`relative ${isEllipsisDropdownOpen ? 'z-50' : ''}`}>
				<button
					type="button"
					onclick={(e) => {
						e.stopPropagation();
						isEllipsisDropdownOpen = !isEllipsisDropdownOpen;
					}}
					class="px-2 py-1.5 border-2 border-border-color bg-surface hover:bg-muted shadow-[2px_2px_0px_var(--shadow-color)] font-mono text-xs font-black cursor-pointer"
					title="Show hidden intermediate folders"
					aria-label="Expand intermediate folders"
				>
					...
				</button>

				{#if isEllipsisDropdownOpen}
					<div
						role="menu"
						use:clickOutside={() => (isEllipsisDropdownOpen = false)}
						onkeydown={(e) => {
							if (e.key === 'Escape') isEllipsisDropdownOpen = false;
						}}
						tabindex="-1"
						class="absolute left-0 top-full mt-1.5 z-50 w-52 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] py-1 font-mono text-xs animate-slide-down"
					>
						<div class="px-2.5 py-1 text-[10px] text-text-muted uppercase border-b border-border-color/20 font-bold">
							Intermediate Folders
						</div>
						{#each visibleCrumbs.collapsed as folder (folder.id)}
							<button
								type="button"
								role="menuitem"
								onclick={() => {
									isEllipsisDropdownOpen = false;
									handleNavigate(folder.id);
								}}
								class="w-full text-left px-3 py-1.5 hover:bg-muted/80 flex items-center gap-2 truncate cursor-pointer"
							>
								<span>📁</span>
								<span class="truncate">{folder.name}</span>
							</button>
						{/each}
					</div>
				{/if}
			</li>

			<li class="text-text-muted font-bold select-none px-0.5">/</li>
		{/if}

		<!-- Visible Tail Crumbs -->
		{#each visibleCrumbs.tail as folder, idx (folder.id)}
			{@const isCurrent = folder.id === app.folders.activeFolderId}
			{@const siblings = getSiblings(folder)}

			<li
				class={`relative flex items-center ${openSiblingDropdown === folder.id ? 'z-50' : ''}`}
				ondragover={(e) => handleDragOver(e, folder.id)}
				ondragleave={() => handleDragLeave(folder.id)}
				ondrop={(e) => handleDrop(e, folder.id)}
			>
				<button
					type="button"
					onclick={() => handleNavigate(folder.id)}
					class={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border-2 transition-all cursor-pointer select-none ${
						isCurrent
							? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)]'
							: 'bg-muted/40 text-text-primary border-border-color hover:bg-muted shadow-[2px_2px_0px_var(--shadow-color)]'
					} ${activeDragTargetId === folder.id ? '!bg-amber-500/20 !border-amber-500 ring-2 ring-amber-400' : ''}`}
					title={`${folder.name} (Drag paper here to move into this folder)`}
				>
					<span>📁</span>
					<span class="max-w-[150px] sm:max-w-[200px] truncate uppercase">{folder.name}</span>
				</button>

				<!-- Sibling Folders Dropdown -->
				{#if siblings.length > 0}
					<div class={`relative ml-0.5 ${openSiblingDropdown === folder.id ? 'z-50' : ''}`}>
						<button
							type="button"
							onclick={(e) => {
								e.stopPropagation();
								openSiblingDropdown = openSiblingDropdown === folder.id ? null : folder.id;
							}}
							class="p-1 border border-border-color/60 bg-muted/30 hover:bg-muted hover:border-border-color text-text-muted hover:text-text-primary transition-colors cursor-pointer"
							title={`Sibling folders at this level (${siblings.length})`}
							aria-label="View sibling folders"
						>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3">
								<path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
							</svg>
						</button>

						{#if openSiblingDropdown === folder.id}
							<div
								role="menu"
								use:clickOutside={() => (openSiblingDropdown = null)}
								onkeydown={(e) => {
									if (e.key === 'Escape') openSiblingDropdown = null;
								}}
								tabindex="-1"
								class="absolute left-0 top-full mt-1.5 z-50 w-48 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] py-1 font-mono text-xs animate-slide-down"
							>
								<div class="px-2.5 py-1 text-[10px] text-text-muted uppercase border-b border-border-color/20 font-bold">
									Sibling Folders
								</div>
								{#each siblings as sib (sib.id)}
									<button
										type="button"
										role="menuitem"
										onclick={() => {
											openSiblingDropdown = null;
											handleNavigate(sib.id);
										}}
										class="w-full text-left px-3 py-1.5 hover:bg-muted/80 flex items-center gap-2 truncate cursor-pointer"
									>
										<span>📁</span>
										<span class="truncate">{sib.name}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</li>

			{#if idx < visibleCrumbs.tail.length - 1}
				<li class="text-text-muted font-bold select-none px-0.5">/</li>
			{/if}
		{/each}
	</ol>

	<!-- Right: Action Buttons (+ New Folder & Manage Folders) -->
	<div class="flex items-center gap-2 shrink-0">
		{#if isCreatingFolder}
			<form
				onsubmit={handleSaveCreate}
				class="flex items-center gap-1.5 animate-slide-down"
			>
				<input
					bind:this={creationInputRef}
					type="text"
					bind:value={newFolderName}
					placeholder="Folder name..."
					class="neo-input text-xs font-bold py-1 px-2.5 h-8 bg-surface border-2 border-border-color"
					onkeydown={(e) => {
						if (e.key === 'Escape') handleCancelCreate();
					}}
				/>
				<button
					type="submit"
					class="neo-btn neo-btn-primary text-xs py-1 px-2.5 h-8 font-bold cursor-pointer"
				>
					Save
				</button>
				<button
					type="button"
					onclick={handleCancelCreate}
					class="neo-btn text-xs py-1 px-2 h-8 cursor-pointer"
					title="Cancel"
				>
					✕
				</button>
			</form>
		{:else}
			<button
				type="button"
				onclick={handleStartCreate}
				class="neo-btn text-xs py-1.5 px-3 font-bold inline-flex items-center gap-1.5 cursor-pointer bg-surface hover:bg-muted"
				title="Create a new folder here"
			>
				<span class="font-black">+</span>
				<span>New Folder</span>
			</button>
		{/if}

		<button
			type="button"
			onclick={() => app.modals.openFolders()}
			class="neo-btn text-xs py-1.5 px-3 font-bold inline-flex items-center gap-1.5 cursor-pointer bg-surface hover:bg-muted"
			title="Manage and organize all folders"
		>
			<span>⚙️</span>
			<span>Manage Folders</span>
		</button>
	</div>
</nav>

{#if createError}
	<div class="neo-box p-2 bg-rose-500/10 border-2 border-rose-500 font-mono text-xs text-rose-600 dark:text-rose-400 mt-2 flex items-center justify-between">
		<span>{createError}</span>
		<button type="button" onclick={() => (createError = '')} class="cursor-pointer font-bold">✕</button>
	</div>
{/if}
