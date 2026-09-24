<script lang="ts">
import { clickOutside } from '$lib/actions/clickOutside';
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { TestItem, TestStatus } from '$lib/types/test';

interface Props {
	test: TestItem;
	status?: TestStatus | string;
	onviewdetails?: () => void;
	onedit?: () => void;
	onmovetofolder?: () => void;
	ongeneratesimilar?: () => void;
	onrename?: () => void;
	onretry?: () => void;
	oncancel?: () => void;
	ondelete?: () => void;
}

const {
	test,
	status = test.status || 'ready',
	onviewdetails,
	onedit,
	onmovetofolder,
	ongeneratesimilar,
	onrename,
	onretry,
	oncancel,
	ondelete,
}: Props = $props();

const app = getAppContext();

let isMenuOpen = $state(false);
let wasMenuOpen = false;
let triggerButtonRef = $state<HTMLButtonElement | null>(null);

function closeMenu(restoreFocus = false) {
	isMenuOpen = false;
	if (restoreFocus) {
		triggerButtonRef?.focus();
	}
}

function handleViewDetails() {
	closeMenu();
	if (onviewdetails) {
		onviewdetails();
	} else {
		app.modals.openDetails(test);
	}
}

function handleEdit() {
	closeMenu();
	if (onedit) {
		onedit();
	} else {
		app.modals.openEdit(test);
	}
}

function handleMoveToFolder() {
	closeMenu();
	if (onmovetofolder) {
		onmovetofolder();
	} else {
		app.modals.openMoveToFolder(test);
	}
}

function handleGenerateSimilar() {
	closeMenu();
	if (ongeneratesimilar) {
		ongeneratesimilar();
	} else {
		app.modals.openSimilarPaperModal(test);
	}
}

function handleRename() {
	closeMenu();
	onrename?.();
}

function handleRetry() {
	closeMenu();
	onretry?.();
}

function handleCancel() {
	closeMenu();
	oncancel?.();
}

function handleDelete() {
	closeMenu();
	ondelete?.();
}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && isMenuOpen) {
			e.stopPropagation();
			closeMenu(true);
		}
	}}
/>

<div class="relative test-card-menu-container">
	<button
		bind:this={triggerButtonRef}
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
			tabindex="-1"
			class="absolute right-0 top-full mt-1.5 z-30 w-48 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] py-1 font-mono text-xs animate-slide-down"
			role="menu"
		>
			{#if status === 'processing'}
				<!-- Processing Ingestion Menu Items -->
				<button
					type="button"
					onclick={handleCancel}
					class="w-full text-left px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 font-bold cursor-pointer transition-colors"
					role="menuitem"
				>
					<span>✕</span>
					<span>Cancel Ingestion</span>
				</button>
			{:else}
				<!-- Ready or Error Menu Items -->
				{#if status === 'error'}
					<button
						type="button"
						onclick={handleRetry}
						class="w-full text-left px-3 py-2 text-text-primary hover:bg-muted/70 flex items-center gap-2.5 font-bold cursor-pointer transition-colors group"
						role="menuitem"
					>
						<span class="text-text-muted group-hover:text-text-primary">↺</span>
						<span>Retry Ingestion</span>
					</button>
				{/if}

				<button
					type="button"
					onclick={handleMoveToFolder}
					class="w-full text-left px-3 py-2 text-text-primary hover:bg-muted/70 flex items-center gap-2.5 font-bold cursor-pointer transition-colors group"
					role="menuitem"
				>
					<span class="text-text-muted group-hover:text-text-primary">📁</span>
					<span>Move to Folder...</span>
				</button>

				{#if status === 'ready'}
					{#if onrename}
						<button
							type="button"
							onclick={handleRename}
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
					{/if}

					<button
						type="button"
						onclick={handleGenerateSimilar}
						class="w-full text-left px-3 py-2 text-text-primary hover:bg-muted/70 flex items-center gap-2.5 font-bold cursor-pointer transition-colors group"
						role="menuitem"
					>
						<span class="text-text-muted group-hover:text-text-primary">✨</span>
						<span>Generate Similar</span>
					</button>

					<button
						type="button"
						onclick={handleEdit}
						class="w-full text-left px-3 py-2 text-text-primary hover:bg-muted/70 flex items-center gap-2.5 font-bold cursor-pointer transition-colors group"
						role="menuitem"
					>
						<span class="text-text-muted group-hover:text-text-primary">📝</span>
						<span>Edit Metadata</span>
					</button>
				{/if}

				<div class="my-1 border-t border-border-color/20"></div>

				<button
					type="button"
					onclick={handleDelete}
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
