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

async function handleKeepSeparate() {
	isProcessing = true;
	try {
		await app.auth.keepCloudOnly();
	} finally {
		isProcessing = false;
	}
}

function handleDismiss() {
	app.auth.showDeviceSyncPrompt = false;
}
</script>

{#if app.auth.showDeviceSyncPrompt}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="device-sync-prompt-title"
	>
		<!-- Backdrop -->
		<div
			class="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
			aria-hidden="true"
			onclick={handleDismiss}
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
							Move Guest Papers to Your Account?
						</h2>
						<p class="font-mono text-xs text-text-muted">
							Guest profile assessments detected
						</p>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<span class="neo-badge bg-amber-500 text-black border-amber-600 text-[10px] font-bold">
						{app.auth.pendingLocalTestsCount} {app.auth.pendingLocalTestsCount === 1 ? 'Paper' : 'Papers'}
					</span>
					<button
						type="button"
						onclick={handleDismiss}
						class="flex h-7 w-7 items-center justify-center border-2 border-border-color bg-surface text-text-muted hover:text-text-primary hover:bg-muted font-bold transition-colors cursor-pointer"
						aria-label="Close dialog"
					>
						&times;
					</button>
				</div>
			</div>

			<!-- Body -->
			<div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
				<p class="font-mono text-xs sm:text-sm text-text-secondary leading-relaxed">
					You are signed into <span class="font-bold text-text-primary underline">{app.auth.userEmail}</span>, but this machine has <span class="font-bold text-text-primary">{app.auth.pendingLocalTestsCount} {app.auth.pendingLocalTestsCount === 1 ? 'assessment paper' : 'assessment papers'}</span> in the Guest profile. Would you like to move them to your account?
				</p>

				<!-- Options Selection Grid -->
				<div class="space-y-3">
					<!-- Option 1: Move to My Account (Recommended) -->
					<div
						class="neo-box p-4 bg-muted/30 border-2 border-border-color hover:border-accent-contrast transition-colors space-y-2 relative"
					>
						<div class="flex items-start justify-between gap-2">
							<div class="space-y-1">
								<div class="flex items-center gap-2">
									<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
										1. Yes, Move to My Account & Sync
									</span>
									<span class="neo-badge bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/50 text-[9px] uppercase font-bold">
										Recommended
									</span>
								</div>
								<p class="font-mono text-xs text-text-muted leading-relaxed">
									Transfers all guest papers, folders, and history into your account and syncs them to your cloud backup. The Guest profile will be cleared.
								</p>
							</div>
						</div>

						<button
							type="button"
							onclick={handleMerge}
							disabled={isProcessing}
							class="neo-btn w-full mt-2 py-2.5 px-3 bg-accent-contrast text-accent-contrast-text text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--shadow-color)] flex items-center justify-center gap-2 cursor-pointer"
						>
							{#if isProcessing}
								<span class="inline-block h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
								<span>Moving & Syncing...</span>
							{:else}
								<span>Move to My Account & Sync to Cloud</span>
							{/if}
						</button>
					</div>

					<!-- Option 2: Keep Guest Separate -->
					<div
						class="neo-box p-4 bg-muted/30 border-2 border-border-color hover:border-accent-contrast transition-colors space-y-2"
					>
						<div class="space-y-1">
							<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
								2. No, Keep Guest Separate
							</span>
							<p class="font-mono text-xs text-text-muted leading-relaxed">
								Keep the guest papers separate in the Guest profile. Your account will start clean or load only what is in your cloud library.
							</p>
						</div>

						<button
							type="button"
							onclick={handleKeepSeparate}
							disabled={isProcessing}
							class="neo-btn w-full mt-2 py-2 px-3 bg-surface hover:bg-muted text-text-primary border-2 border-border-color text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_var(--shadow-color)] cursor-pointer"
						>
							{#if isProcessing}
								<span class="inline-block h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
								<span>Applying...</span>
							{:else}
								<span>Keep Guest Separate</span>
							{/if}
						</button>
					</div>
				</div>

				<!-- Secondary Action / Dismiss -->
				<div class="pt-2 text-center">
					<button
						type="button"
						onclick={handleDismiss}
						disabled={isProcessing}
						class="font-mono text-xs text-text-muted hover:text-text-primary uppercase tracking-wider underline cursor-pointer"
					>
						Decide Later / Dismiss
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
