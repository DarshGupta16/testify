<script lang="ts">
import { goto } from '$app/navigation';
import { clickOutside } from '$lib/actions/clickOutside';
import InlineFolderCreator from '$lib/components/common/InlineFolderCreator.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { FolderItem } from '$lib/types/folder';

const app = getAppContext();

// Inline new folder creation state
let isCreatingFolder = $state(false);

// Sibling dropdown state: key is folder id or 'root'
let openSiblingDropdown = $state<string | null>(null);

// Drag & drop highlight state: folder id or 'root'
let activeDragTargetId = $state<string | null>(null);

// Ellipsis dropdown state for collapsed crumbs
let isEllipsisDropdownOpen = $state(false);

// Dynamic container and action button widths for space-aware calculations
let navWidth = $state(0);
let actionsWidth = $state(0);

const activePath = $derived(app.folders.activeFolderPath);
const isRoot = $derived(!app.folders.activeFolderId);

// Mobile check: under 640px
const isMobile = $derived(navWidth > 0 && navWidth < 640);

// Available width for the breadcrumbs trail on desktop (navWidth minus actionsWidth and gaps/padding)
const availableTrailWidth = $derived(
	navWidth > 0 ? Math.max(160, navWidth - (actionsWidth || 220) - 32) : 800
);

// Estimated full un-truncated width of the entire trail on desktop:
// Root crumb (~165px) + each folder (~92px overhead + name.length * 8px)
const estimatedFullWidth = $derived(
	165 + activePath.reduce((acc, f) => acc + 92 + f.name.length * 8, 0)
);

// Estimated width if names are moderately truncated (capped at ~176px per folder):
const estimatedTruncatedWidth = $derived(165 + activePath.length * 176);

// Space-aware collapse rule:
// - On mobile: keep existing reliable system (> 2 folders)
// - On desktop: only collapse intermediate folders when space is seriously lacking
const shouldCollapse = $derived.by(() => {
	if (activePath.length <= 2) return false;
	if (isMobile) return true;
	return estimatedTruncatedWidth > availableTrailWidth;
});

// Dynamic truncation class for folder names:
// - On mobile: max-w-[100px]
// - On desktop:
//   - If plenty of room: no truncation ('max-w-none')
//   - If room begins to lack: moderate truncation ('max-w-[160px] lg:max-w-[260px]')
//   - If space is tight: tighter truncation ('max-w-[130px] sm:max-w-[170px]')
const truncateClass = $derived.by(() => {
	if (isMobile) return 'max-w-[100px]';
	if (estimatedFullWidth <= availableTrailWidth) return 'max-w-none';
	if (estimatedTruncatedWidth <= availableTrailWidth) return 'max-w-[160px] lg:max-w-[260px]';
	return 'max-w-[130px] sm:max-w-[170px]';
});

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
	// Keep the first ancestor, collapse intermediate ones, keep the last folder
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
	bind:clientWidth={navWidth}
	aria-label="Folder Breadcrumb Navigation"
	class="relative z-30 neo-box p-2 sm:p-2.5 bg-surface flex flex-wrap items-center justify-between gap-2 sm:gap-3 border-2 border-border-color"
>
	<!-- Left: Interactive Breadcrumb Trail -->
	<ol class="flex flex-wrap items-center gap-1 sm:gap-1.5 text-xs font-mono font-bold">
		<!-- Root Crumb (All Assessments) -->
		<li
			class={`relative inline-flex items-center shadow-[2px_2px_0px_var(--shadow-color)] border-2 ${
				isRoot
					? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast'
					: 'bg-muted/50 text-text-primary border-border-color'
			} ${activeDragTargetId === 'root' ? '!bg-amber-500/20 !border-amber-500 ring-2 ring-amber-400' : ''} ${openSiblingDropdown === 'root' ? 'z-50' : ''}`}
			ondragover={(e) => handleDragOver(e, null)}
			ondragleave={() => handleDragLeave(null)}
			ondrop={(e) => handleDrop(e, null)}
		>
			<button
				type="button"
				onclick={() => handleNavigate(null)}
				class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold font-mono transition-colors cursor-pointer select-none"
				title="Root / All Assessments (Drag paper here to move to root)"
			>
				<span class="text-xs">🏠</span>
				<span class="uppercase tracking-tight">
					{#if isRoot}
						<span class="sm:hidden">All</span>
						<span class="hidden sm:inline">All Assessments</span>
					{:else}
						<span class="hidden sm:inline">All</span>
					{/if}
				</span>
			</button>

			<!-- Root Siblings Dropdown (Quick hopping to other root folders) -->
			{#if app.folders.rootFolders.length > 0}
				<button
					type="button"
					onclick={(e) => {
						e.stopPropagation();
						openSiblingDropdown = openSiblingDropdown === 'root' ? null : 'root';
					}}
					class={`h-full px-1.5 py-1.5 border-l transition-colors cursor-pointer flex items-center justify-center ${
						isRoot
							? 'border-accent-contrast-text/25 hover:bg-white/20 text-accent-contrast-text'
							: 'border-border-color/30 hover:bg-muted text-text-muted hover:text-text-primary'
					}`}
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
						class="absolute left-0 top-full mt-1.5 z-50 w-48 bg-surface text-text-primary border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] py-1 font-mono text-xs animate-slide-down"
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
								class={`w-full text-left px-3 py-1.5 hover:bg-muted/80 flex items-center gap-2 truncate cursor-pointer text-text-primary ${
									app.folders.activeFolderId === rootF.id ? 'font-black bg-muted/40' : ''
								}`}
							>
								<span>📁</span>
								<span class="truncate">{rootF.name}</span>
							</button>
						{/each}
					</div>
				{/if}
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
				class="relative flex items-center shadow-[2px_2px_0px_var(--shadow-color)] border-2 border-border-color bg-muted/40"
				ondragover={(e) => handleDragOver(e, first.id)}
				ondragleave={() => handleDragLeave(first.id)}
				ondrop={(e) => handleDrop(e, first.id)}
			>
				<button
					type="button"
					onclick={() => handleNavigate(first.id)}
					class={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold font-mono hover:bg-muted transition-all cursor-pointer ${
						activeDragTargetId === first.id ? '!bg-amber-500/20 !border-amber-500 ring-2 ring-amber-400' : ''
					}`}
					title={first.name}
				>
					<span class="text-xs">📁</span>
					<span class={`${truncateClass} truncate uppercase`}>{first.name}</span>
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
						class="absolute left-0 top-full mt-1.5 z-50 w-52 bg-surface text-text-primary border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] py-1 font-mono text-xs animate-slide-down"
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
								class="w-full text-left px-3 py-1.5 hover:bg-muted/80 flex items-center gap-2 truncate cursor-pointer text-text-primary"
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
				class={`relative inline-flex items-center shadow-[2px_2px_0px_var(--shadow-color)] border-2 ${
					isCurrent
						? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast'
						: 'bg-muted/40 text-text-primary border-border-color'
				} ${activeDragTargetId === folder.id ? '!bg-amber-500/20 !border-amber-500 ring-2 ring-amber-400' : ''} ${openSiblingDropdown === folder.id ? 'z-50' : ''}`}
				ondragover={(e) => handleDragOver(e, folder.id)}
				ondragleave={() => handleDragLeave(folder.id)}
				ondrop={(e) => handleDrop(e, folder.id)}
			>
				<button
					type="button"
					onclick={() => handleNavigate(folder.id)}
					class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold font-mono transition-colors cursor-pointer select-none"
					title={`${folder.name} (Drag paper here to move into this folder)`}
				>
					<span class="text-xs">📁</span>
					<span class={`${truncateClass} truncate uppercase`}>{folder.name}</span>
				</button>

				<!-- Sibling Folders Dropdown -->
				{#if siblings.length > 0}
					<button
						type="button"
						onclick={(e) => {
							e.stopPropagation();
							openSiblingDropdown = openSiblingDropdown === folder.id ? null : folder.id;
						}}
						class={`h-full px-1.5 py-1.5 border-l transition-colors cursor-pointer flex items-center justify-center ${
							isCurrent
								? 'border-accent-contrast-text/25 hover:bg-white/20 text-accent-contrast-text'
								: 'border-border-color/30 hover:bg-muted text-text-muted hover:text-text-primary'
						}`}
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
							class="absolute left-0 top-full mt-1.5 z-50 w-48 bg-surface text-text-primary border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] py-1 font-mono text-xs animate-slide-down"
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
									class="w-full text-left px-3 py-1.5 hover:bg-muted/80 flex items-center gap-2 truncate cursor-pointer text-text-primary"
								>
									<span>📁</span>
									<span class="truncate">{sib.name}</span>
								</button>
							{/each}
						</div>
					{/if}
				{/if}
			</li>

			{#if idx < visibleCrumbs.tail.length - 1}
				<li class="text-text-muted font-bold select-none px-0.5">/</li>
			{/if}
		{/each}
	</ol>

	<!-- Right: Action Buttons (+ New Folder & Manage Folders) -->
	<div bind:clientWidth={actionsWidth} class="flex items-center gap-1.5 sm:gap-2 shrink-0">
		{#if isCreatingFolder}
			<InlineFolderCreator
				parentId={app.folders.activeFolderId}
				placeholder="Folder name..."
				buttonLabel="Save"
				oncreated={() => (isCreatingFolder = false)}
				oncancel={() => (isCreatingFolder = false)}
			/>
		{:else}
			<button
				type="button"
				onclick={() => (isCreatingFolder = true)}
				class="neo-btn text-xs !py-1.5 !px-2.5 sm:!px-3 !gap-1.5 font-bold hidden sm:inline-flex items-center cursor-pointer bg-surface hover:bg-muted shadow-[2px_2px_0px_var(--shadow-color)]"
				title="Create a new folder here"
			>
				<span class="font-black text-xs leading-none">+</span>
				<span>New Folder</span>
			</button>
		{/if}

		<button
			type="button"
			onclick={() => app.modals.openFolders()}
			class="neo-btn text-xs !py-1.5 !px-2.5 sm:!px-3 !gap-1.5 font-bold inline-flex items-center cursor-pointer bg-surface hover:bg-muted shadow-[2px_2px_0px_var(--shadow-color)]"
			title="Manage and organize all folders"
		>
			<span class="text-xs leading-none">⚙️</span>
			<span>Manage</span>
			<span class="hidden sm:inline">Folders</span>
		</button>
	</div>
</nav>
