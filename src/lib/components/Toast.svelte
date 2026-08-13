<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();
</script>

{#if app.toast.current}
	<aside
		aria-live="polite"
		class="fixed bottom-6 right-6 z-50 animate-slide-down"
	>
		<div class="neo-box-lg px-4 py-3 bg-surface flex items-center gap-3 border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)]">
			<div
				class={`h-3 w-3 ${
					app.toast.current.type === 'success'
						? 'bg-emerald-500'
						: app.toast.current.type === 'error'
							? 'bg-rose-500'
							: app.toast.current.type === 'warning'
								? 'bg-amber-500'
								: 'bg-accent-contrast'
				}`}
			></div>
			<p class="font-mono text-xs font-bold text-text-primary">
				{app.toast.current.message}
			</p>
			<button
				type="button"
				onclick={() => app.toast.dismiss()}
				class="ml-2 font-mono text-xs text-text-muted hover:text-text-primary cursor-pointer"
				aria-label="Dismiss toast"
			>
				✕
			</button>
		</div>
	</aside>
{/if}
