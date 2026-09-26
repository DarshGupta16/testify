<script lang="ts">
import { dev } from '$app/environment';
import favicon from '$lib/assets/favicon.svg';
import DevPipelineHistoryModal from '$lib/components/dev/DevPipelineHistoryModal.svelte';
import UserNavMenu from '$lib/components/layout/UserNavMenu.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

let isDevTraceModalOpen = $state(false);
</script>

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

			<!-- Authentication & Cloud Sync Section -->
			<UserNavMenu />
		</div>
	</div>
</header>

{#if dev}
	<DevPipelineHistoryModal
		bind:isOpen={isDevTraceModalOpen}
		onclose={() => (isDevTraceModalOpen = false)}
	/>
{/if}

