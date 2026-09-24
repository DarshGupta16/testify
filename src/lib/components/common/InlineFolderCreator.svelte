<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { FolderItem } from '$lib/types/folder';

interface Props {
	parentId: string | null;
	placeholder?: string;
	buttonLabel?: string;
	oncreated?: (folder: FolderItem) => void;
	oncancel?: () => void;
	class?: string;
}

let {
	parentId,
	placeholder = 'Enter folder name...',
	buttonLabel = 'Save',
	oncreated,
	oncancel,
	class: className = '',
}: Props = $props();

const app = getAppContext();

let folderName = $state('');
let error = $state('');
let isSubmitting = $state(false);

/**
 * Svelte action to autofocus on mount synchronously without leaky timers (no setTimeout).
 */
function autofocus(node: HTMLInputElement) {
	node.focus();
}

function handleCancel() {
	folderName = '';
	error = '';
	oncancel?.();
}

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		e.stopPropagation();
		handleCancel();
	}
}

async function handleSubmit(e?: SubmitEvent) {
	e?.preventDefault();
	error = '';
	const trimmed = folderName.trim();
	if (!trimmed) {
		error = 'Folder name cannot be empty';
		return;
	}

	isSubmitting = true;
	try {
		const created = await app.folders.addFolder(trimmed, parentId);
		app.toast.show(`Folder "${created.name}" created!`, 'success');
		folderName = '';
		oncreated?.(created);
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to create folder';
	} finally {
		isSubmitting = false;
	}
}
</script>

<form
	onsubmit={handleSubmit}
	class={`flex flex-col gap-1.5 font-mono text-xs ${className}`}
>
	<div class="flex items-center gap-1.5 w-full">
		<input
			use:autofocus
			type="text"
			bind:value={folderName}
			onkeydown={handleKeyDown}
			oninput={() => {
				if (error) error = '';
			}}
			{placeholder}
			disabled={isSubmitting}
			class="neo-input flex-1 min-w-0 text-xs font-bold py-1 px-2.5 h-8 bg-surface border-2 border-border-color"
		/>

		<button
			type="submit"
			disabled={isSubmitting}
			class="neo-btn neo-btn-primary text-xs py-1 px-3 h-8 font-bold cursor-pointer shrink-0 disabled:opacity-50"
		>
			{isSubmitting ? 'Saving...' : buttonLabel}
		</button>

		{#if oncancel}
			<button
				type="button"
				onclick={handleCancel}
				disabled={isSubmitting}
				class="neo-btn text-xs py-1 px-2.5 h-8 cursor-pointer shrink-0"
				title="Cancel"
				aria-label="Cancel"
			>
				Cancel
			</button>
		{/if}
	</div>

	{#if error}
		<p class="text-[11px] font-mono font-bold text-rose-600 dark:text-rose-400">
			{error}
		</p>
	{/if}
</form>
