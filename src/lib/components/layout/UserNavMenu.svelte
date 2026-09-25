<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

let isUserMenuOpen = $state(false);

function toggleUserMenu() {
	isUserMenuOpen = !isUserMenuOpen;
}

function closeUserMenu() {
	isUserMenuOpen = false;
}

function handleKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape' && isUserMenuOpen) {
		closeUserMenu();
	}
}
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="relative">
	<button
		type="button"
		onclick={toggleUserMenu}
		class="neo-btn text-[11px] sm:text-xs py-1 px-2 sm:py-1.5 sm:px-2.5 flex items-center gap-1.5 font-mono font-bold whitespace-nowrap bg-surface"
		aria-label="Account and Cloud Sync Options"
		aria-expanded={isUserMenuOpen}
	>
		{#if app.auth.syncStatus === 'syncing'}
			<span class="inline-block h-2 w-2 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
			<span class="hidden sm:inline">Syncing</span>
		{:else if app.auth.syncStatus === 'synced'}
			<span class="h-2 w-2 rounded-full bg-emerald-500"></span>
			<span class="hidden sm:inline">Synced</span>
		{:else if app.auth.syncStatus === 'error'}
			<span class="h-2 w-2 rounded-full bg-rose-500"></span>
			<span class="hidden sm:inline text-rose-500">Error</span>
		{:else}
			<span class="h-2 w-2 rounded-full bg-amber-500"></span>
			<span class="hidden sm:inline">Offline</span>
		{/if}

		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			class="h-3 w-3 text-text-muted"
		>
			<path d="M6 9l6 6 6-6" />
		</svg>
	</button>

	<!-- User Menu Dropdown -->
	{#if isUserMenuOpen}
		<button
			type="button"
			class="fixed inset-0 z-40 cursor-default bg-transparent"
			onclick={closeUserMenu}
			aria-label="Close user menu"
		></button>

		<div
			class="neo-box absolute right-0 mt-2 z-50 w-64 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] p-3 space-y-2.5 animate-slide-down"
		>
			<div class="space-y-0.5 border-b-2 border-border-color pb-2">
				<span
					class="font-mono text-[10px] uppercase font-bold text-text-muted tracking-wider block"
				>
					Account
				</span>
				<p
					class="font-mono text-xs font-bold text-text-primary truncate"
					title={app.auth.userEmail}
				>
					{app.auth.userEmail}
				</p>
			</div>

			<div class="flex items-center justify-between text-[11px] font-mono">
				<span class="text-text-muted">Cloud Sync:</span>
				<span
					class="font-bold uppercase {app.auth.syncStatus === 'synced'
						? 'text-emerald-600 dark:text-emerald-400'
						: app.auth.syncStatus === 'syncing'
							? 'text-blue-500'
							: 'text-amber-500'}"
				>
					{app.auth.syncStatus}
				</span>
			</div>

			<div class="space-y-1.5 pt-1">
				<button
					type="button"
					onclick={async () => {
						closeUserMenu();
						await app.auth.syncNow();
					}}
					class="neo-btn w-full py-1.5 px-2.5 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 bg-surface hover:bg-muted"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="h-3.5 w-3.5"
					>
						<path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
					</svg>
					<span>Sync Now</span>
				</button>

				<a
					href="/settings"
					onclick={closeUserMenu}
					class="neo-btn w-full py-1.5 px-2.5 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 bg-surface hover:bg-muted text-text-primary"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="h-3.5 w-3.5"
					>
						<circle cx="12" cy="12" r="3" />
						<path
							d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
						/>
					</svg>
					<span>Settings</span>
				</a>

				<button
					type="button"
					onclick={async () => {
						closeUserMenu();
						await app.auth.signOut();
					}}
					class="neo-btn w-full py-1.5 px-2.5 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/50"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="h-3.5 w-3.5"
					>
						<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
						<polyline points="16 17 21 12 16 7" />
						<line x1="21" y1="12" x2="9" y2="12" />
					</svg>
					<span>Sign Out</span>
				</button>
			</div>
		</div>
	{/if}
</div>
