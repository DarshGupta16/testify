<script lang="ts">
import { getTestStore } from '$lib/stores/testStore.svelte';

const store = getTestStore();
</script>

{#if store.toast}
	<aside
		aria-live="polite"
		class="fixed bottom-6 right-6 z-50 animate-slide-down"
	>
		<div class="neo-box-lg px-4 py-3 bg-surface flex items-center gap-3 border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)]">
			<div
				class={`h-3 w-3 ${
					store.toast.type === 'success'
						? 'bg-emerald-500'
						: store.toast.type === 'error'
							? 'bg-red-500'
							: store.toast.type === 'warning'
								? 'bg-amber-500'
								: 'bg-accent-contrast'
				}`}
			></div>
			<p class="font-mono text-xs font-bold text-text-primary">
				{store.toast.message}
			</p>
			<button
				type="button"
				onclick={() => {
					store.toast = null;
				}}
				class="ml-2 font-mono text-xs text-text-muted hover:text-text-primary cursor-pointer"
				aria-label="Dismiss toast"
			>
				✕
			</button>
		</div>
	</aside>
{/if}
