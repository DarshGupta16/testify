<script lang="ts">
import { dev } from '$app/environment';
import favicon from '$lib/assets/favicon.svg';
import DevPipelineHistoryModal from '$lib/components/dev/DevPipelineHistoryModal.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

let isDevTraceModalOpen = $state(false);
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

<header class="sticky top-0 z-30 w-full border-b-2 border-border-color bg-surface/90 backdrop-blur-md transition-colors">
	<div class="mx-auto flex max-w-7xl items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
		<!-- Brand / Logo -->
		<div class="flex items-center gap-2 sm:gap-3">
			<a
				href="/"
				class="group flex items-center gap-2 sm:gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-color"
				aria-label="Testify Home"
			>
				<div class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center border-2 border-border-color bg-accent-contrast text-accent-contrast-text shadow-[2px_2px_0px_var(--shadow-color)] transition-transform group-hover:-translate-y-0.5 overflow-hidden">
					<img src={favicon} alt="Testify Logo" class="h-full w-full object-cover" />
				</div>
				<span class="font-sans text-base sm:text-xl font-extrabold tracking-tight uppercase">
					Testify
				</span>
			</a>
		</div>

		<!-- Action Controls -->
		<div class="flex items-center gap-1.5 sm:gap-2.5">
			<!-- Offline Connectivity Status Badge -->
			{#if !app.network.isOnline}
				<div
					class="neo-badge bg-amber-500 text-black border-amber-600 font-mono text-[9px] sm:text-[10px] font-black tracking-wider flex items-center gap-1 sm:gap-1.5 animate-pulse"
					title="Offline Mode: Testify is running locally from IndexedDB cache"
				>
					<span class="inline-block h-1.5 w-1.5 bg-black rounded-full"></span>
					<span>OFFLINE</span>
				</div>
			{/if}

			<!-- PWA Install Application CTA -->
			{#if app.network.isInstallable}
				<button
					type="button"
					onclick={() => app.network.promptInstall()}
					class="neo-btn text-[11px] sm:text-xs py-1 px-2 sm:py-1.5 sm:px-2.5 flex items-center gap-1.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/25 font-bold whitespace-nowrap"
					aria-label="Install Testify as an Application"
					title="Install Testify as a desktop or mobile application"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="square"
						class="h-3 w-3 sm:h-3.5 sm:w-3.5"
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="7 10 12 15 17 10" />
						<line x1="12" y1="15" x2="12" y2="3" />
					</svg>
					<span class="hidden md:inline">Install App</span>
				</button>
			{/if}

			<!-- Dev-Only Pipeline Inspector Button -->
			{#if dev}
				<button
					type="button"
					onclick={() => (isDevTraceModalOpen = true)}
					class="neo-btn text-[11px] sm:text-xs py-1 px-2 sm:py-1.5 sm:px-2.5 flex items-center gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/20 font-mono font-bold whitespace-nowrap"
					aria-label="Open Dev Pipeline Trace Inspector"
					title="Inspect all AI and PDF pipeline stages & IndexedDB traces"
				>
					<span>⚡</span>
					<span class="hidden md:inline">Dev Pipeline</span>
				</button>
			{/if}

			<!-- Background Generation Queue Trigger -->
			{#if app.queue.jobs.length > 0}
				<button
					type="button"
					onclick={() => app.queue.toggleDrawer()}
					class={`neo-btn text-[11px] sm:text-xs py-1 px-2 sm:py-1.5 sm:px-2.5 flex items-center gap-1.5 font-mono font-bold whitespace-nowrap ${
						app.queue.activeCount > 0
							? 'bg-accent-contrast text-accent-contrast-text animate-pulse'
							: app.queue.failedJobs.length > 0
								? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/50'
								: 'bg-muted/40'
					}`}
					aria-label="Toggle Generation Queue"
					title={`Background Queue: ${app.queue.activeCount} active, ${app.queue.queuedCount} queued`}
				>
					{#if app.queue.activeCount > 0}
						<span class="inline-block h-2 w-2 bg-current rounded-full animate-ping"></span>
						<span>Queue ({app.queue.activeCount}/{app.queue.incompleteCount})</span>
					{:else if app.queue.failedJobs.length > 0}
						<span class="text-rose-500">✕</span>
						<span>Queue ({app.queue.failedJobs.length} Failed)</span>
					{:else}
						<span>⚡ Queue ({app.queue.jobs.length})</span>
					{/if}
				</button>
			{/if}

			<!-- API Keys / Provider Credentials CTA -->
			<button
				type="button"
				onclick={() => app.modals.openApiKeys()}
				class={`neo-btn text-[11px] sm:text-xs py-1 px-2 sm:py-1.5 sm:px-3 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
					app.apiKeys.hasAnyConfigured ? 'bg-surface' : 'bg-muted/40'
				}`}
				aria-label="Manage AI API Keys"
				title="Manage API keys for OpenAI, Anthropic, Google Gemini, and Groq"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="square"
					class="h-3 w-3 sm:h-3.5 sm:w-3.5 text-text-primary"
				>
					<path d="M21 2l-2 2m-1.5 1.5L10 13l-4 4-2-2-4 4 3 3 4-4-2-2 7.5-7.5" />
					<circle cx="16.5" cy="7.5" r="2.5" />
				</svg>
				<span class="hidden sm:inline">API Keys</span>

				{#if app.apiKeys.hasAnyConfigured}
					<span class="font-mono text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/50 leading-none">
						{app.apiKeys.configuredCount}/4
					</span>
				{:else}
					<span class="font-mono text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/50 leading-none">
						Set Keys
					</span>
				{/if}
			</button>

			<!-- Authentication & Cloud Sync Section -->
			{#if app.auth.isAuthenticated}
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
			{:else}
				<!-- Sign In CTA (Guest Mode) -->
				<button
					type="button"
					onclick={() => app.modals.openAuth('signin')}
					class="neo-btn text-[11px] sm:text-xs py-1 px-2.5 sm:py-1.5 sm:px-3 bg-accent-contrast text-accent-contrast-text font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[2px_2px_0px_var(--shadow-color)]"
					aria-label="Sign In or Create Account"
					title="Sign in to enable cross-device cloud sync and backup"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="square"
						class="h-3 w-3 sm:h-3.5 sm:w-3.5"
					>
						<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
						<circle cx="12" cy="7" r="4" />
					</svg>
					<span>Sign In</span>
				</button>
			{/if}

			<!-- Theme Toggle Button -->
			<button
				type="button"
				onclick={() => app.theme.toggleTheme()}
				class="neo-btn py-1 px-1.5 sm:py-1.5 sm:px-2.5 flex items-center justify-center shrink-0"
				aria-label="Toggle theme mode"
				title={`Switch to ${app.theme.theme === 'dark' ? 'Light' : 'Dark'} Mode`}
			>
				{#if app.theme.theme === 'dark'}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="square"
						class="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-300"
					>
						<circle cx="12" cy="12" r="5" />
						<line x1="12" y1="1" x2="12" y2="3" />
						<line x1="12" y1="21" x2="12" y2="23" />
						<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
						<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
						<line x1="1" y1="12" x2="3" y2="12" />
						<line x1="21" y1="12" x2="23" y2="12" />
						<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
						<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
					</svg>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="square"
						class="h-3.5 w-3.5 sm:h-4 sm:w-4 text-text-primary"
					>
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
					</svg>
				{/if}
			</button>
		</div>
	</div>
</header>

{#if dev}
	<DevPipelineHistoryModal
		bind:isOpen={isDevTraceModalOpen}
		onclose={() => (isDevTraceModalOpen = false)}
	/>
{/if}

