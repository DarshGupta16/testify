<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

let isProcessing = $state(false);

async function handleMerge() {
	isProcessing = true;
	try {
		await app.auth.mergeAndUploadLocalData();
	} finally {
		isProcessing = false;
	}
}

async function handleKeepCloud() {
	if (
		!window.confirm(
			'Are you sure you want to replace local papers with your cloud library? Any papers only stored locally on this machine will be lost.'
		)
	) {
		return;
	}
	isProcessing = true;
	try {
		await app.auth.keepCloudOnly();
	} finally {
		isProcessing = false;
	}
}

async function handleSignOut() {
	isProcessing = true;
	try {
		await app.auth.signOut();
	} finally {
		isProcessing = false;
	}
}
</script>

{#if app.auth.showDeviceSyncPrompt}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="device-sync-prompt-title"
	>
		<!-- Backdrop (non-dismissible on outside click to prevent unhandled sync state) -->
		<div
			class="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
			aria-hidden="true"
		></div>

		<!-- Modal Dialog Box -->
		<div
			class="neo-box-lg relative z-10 flex max-h-[94vh] w-full max-w-lg flex-col bg-surface border-2 border-border-color shadow-[6px_6px_0px_var(--shadow-color)] animate-slide-down overflow-hidden"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b-2 border-border-color bg-surface px-4 py-3.5 sm:px-6 sm:py-4"
			>
				<div class="flex items-center gap-2.5 sm:gap-3">
					<div
						class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center border-2 border-border-color bg-amber-500 text-black shadow-[2px_2px_0px_var(--shadow-color)] shrink-0"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="square"
							class="h-4 w-4 sm:h-5 sm:w-5"
						>
							<path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
						</svg>
					</div>
					<div>
						<h2
							id="device-sync-prompt-title"
							class="font-sans text-base sm:text-lg font-extrabold uppercase tracking-tight"
						>
							Device Sync Reconciliation
						</h2>
						<p class="font-mono text-xs text-text-muted">
							Local assessments detected on this machine
						</p>
					</div>
				</div>

				<span class="neo-badge bg-amber-500 text-black border-amber-600 text-[10px] font-bold">
					{app.auth.pendingLocalTestsCount} {app.auth.pendingLocalTestsCount === 1 ? 'Paper' : 'Papers'}
				</span>
			</div>

			<!-- Body -->
			<div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
				<p class="font-mono text-xs sm:text-sm text-text-secondary leading-relaxed">
					You signed into account <span class="font-bold text-text-primary underline">{app.auth.userEmail}</span>, but this device already contains <span class="font-bold text-text-primary">{app.auth.pendingLocalTestsCount} test {app.auth.pendingLocalTestsCount === 1 ? 'paper' : 'papers'}</span> stored locally in offline storage. How would you like to handle them?
				</p>

				<!-- Options Selection Grid -->
				<div class="space-y-3">
					<!-- Option 1: Merge & Upload (Recommended) -->
					<div
						class="neo-box p-4 bg-muted/30 border-2 border-border-color hover:border-accent-contrast transition-colors space-y-2 relative"
					>
						<div class="flex items-start justify-between gap-2">
							<div class="space-y-1">
								<div class="flex items-center gap-2">
									<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
										1. Merge & Upload to Cloud
									</span>
									<span class="neo-badge bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/50 text-[9px] uppercase font-bold">
										Recommended
									</span>
								</div>
								<p class="font-mono text-xs text-text-muted leading-relaxed">
									Upload your local test papers, folders, subjects, and attempt history to your cloud account. All devices will sync together seamlessly.
								</p>
							</div>
						</div>

						<button
							type="button"
							onclick={handleMerge}
							disabled={isProcessing}
							class="neo-btn w-full mt-2 py-2.5 px-3 bg-accent-contrast text-accent-contrast-text text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--shadow-color)] flex items-center justify-center gap-2"
						>
							{#if isProcessing}
								<span class="inline-block h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
								<span>Merging & Uploading...</span>
							{:else}
								<span>Merge & Upload Local Papers</span>
							{/if}
						</button>
					</div>

					<!-- Option 2: Keep Cloud Only -->
					<div
						class="neo-box p-4 bg-muted/30 border-2 border-border-color hover:border-rose-500 transition-colors space-y-2"
					>
						<div class="space-y-1">
							<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
								2. Keep Cloud Only
							</span>
							<p class="font-mono text-xs text-text-muted leading-relaxed">
								Discard local tests on this device and pull only what is saved in your cloud account. Use this if the local papers are disposable or outdated duplicates.
							</p>
						</div>

						<button
							type="button"
							onclick={handleKeepCloud}
							disabled={isProcessing}
							class="neo-btn w-full mt-2 py-2 px-3 bg-surface hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/50 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_var(--shadow-color)]"
						>
							Discard Local & Pull Cloud Only
						</button>
					</div>
				</div>

				<!-- Secondary Action / Dismiss -->
				<div class="pt-2 text-center">
					<button
						type="button"
						onclick={handleSignOut}
						disabled={isProcessing}
						class="font-mono text-xs text-text-muted hover:text-text-primary uppercase tracking-wider underline cursor-pointer"
					>
						Sign Out and Stay Guest (Local-Only)
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
