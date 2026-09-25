<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();
</script>

{#if app.toast.current}
	<aside
		aria-live="polite"
		class="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-70 max-w-md animate-slide-down"
	>
		<div class="neo-box-lg px-4 py-3 bg-surface flex items-center gap-3 border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)]">
			<div
				class={`h-3 w-3 shrink-0 ${
					app.toast.current.type === 'success'
						? 'bg-emerald-500'
						: app.toast.current.type === 'error'
							? 'bg-rose-500'
							: app.toast.current.type === 'warning'
								? 'bg-amber-500'
								: 'bg-accent-contrast'
				}`}
			></div>
			<p class="font-mono text-xs font-bold text-text-primary flex-1 break-words">
				{app.toast.current.message}
			</p>
			{#if app.toast.current.action}
				<button
					type="button"
					onclick={() => {
						app.toast.current?.action?.onClick();
						app.toast.dismiss();
					}}
					class="neo-btn text-[11px] py-1 px-2.5 bg-accent-contrast text-accent-contrast-text font-bold cursor-pointer underline"
				>
					{app.toast.current.action.label}
				</button>
			{/if}
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
