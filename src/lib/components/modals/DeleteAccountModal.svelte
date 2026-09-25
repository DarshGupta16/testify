<script lang="ts">
import { goto } from '$app/navigation';
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

let isDeleting = $state(false);
let selectedMode = $state<'cloud_only' | 'everything' | null>(null);

function handleClose() {
	if (!isDeleting) {
		app.modals.closeDeleteAccount();
		selectedMode = null;
	}
}

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		handleClose();
	}
}

async function confirmDelete(mode: 'cloud_only' | 'everything') {
	selectedMode = mode;
	isDeleting = true;
	try {
		const { error } = await app.auth.deleteAccount(mode);
		if (error) {
			app.toast.show(`Failed to delete account: ${error.message}`, 'error');
		} else {
			app.modals.closeDeleteAccount();
			goto('/', { replaceState: true });
		}
	} finally {
		isDeleting = false;
		selectedMode = null;
	}
}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if app.modals.isDeleteAccountModalOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="delete-account-title"
	>
		<!-- Backdrop -->
		<button
			type="button"
			class="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity cursor-default"
			onclick={handleClose}
			aria-label="Close delete modal background"
		></button>

		<!-- Modal Box -->
		<div
			class="neo-box-lg relative z-10 flex max-h-[94vh] w-full max-w-lg flex-col bg-surface border-2 border-rose-500 shadow-[6px_6px_0px_var(--shadow-color)] animate-slide-down overflow-hidden"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b-2 border-border-color bg-rose-500/10 px-4 py-3.5 sm:px-6 sm:py-4"
			>
				<div class="flex items-center gap-2.5 sm:gap-3">
					<div
						class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center border-2 border-rose-600 bg-rose-500 text-white shadow-[2px_2px_0px_var(--shadow-color)] shrink-0 font-black text-sm"
					>
						!
					</div>
					<div>
						<h2
							id="delete-account-title"
							class="font-sans text-base sm:text-lg font-extrabold uppercase tracking-tight text-rose-600 dark:text-rose-400"
						>
							Delete Account
						</h2>
						<p class="font-mono text-xs text-text-muted">
							Permanent removal options
						</p>
					</div>
				</div>

				<button
					type="button"
					onclick={handleClose}
					disabled={isDeleting}
					class="neo-btn p-1.5 sm:p-2 text-text-muted hover:text-text-primary"
					aria-label="Cancel and Close Modal"
				>
					✕
				</button>
			</div>

			<!-- Body -->
			<div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
				<p class="font-mono text-xs sm:text-sm text-text-secondary leading-relaxed">
					You are about to delete your Testify account <span class="font-bold text-text-primary underline">{app.auth.userEmail}</span>. Choose how to handle your assessment papers:
				</p>

				<!-- Decision Options -->
				<div class="space-y-3 pt-1">
					<!-- Option 1: Cloud Only (Safe / Guest mode) -->
					<div
						class="neo-box p-4 bg-muted/20 border-2 border-border-color hover:border-accent-contrast transition-colors space-y-2.5"
					>
						<div class="flex items-start justify-between gap-2">
							<div class="space-y-1">
								<div class="flex items-center gap-2">
									<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
										1. Delete Cloud Data Only
									</span>
									<span
										class="neo-badge bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/50 text-[9px] uppercase font-bold"
									>
										Preserve Local Papers
									</span>
								</div>
								<p class="font-mono text-xs text-text-muted leading-relaxed">
									Purges your account, cloud database rows, and stored diagrams from Supabase. All tests, attempts, and folders currently on this device will stay in your local browser storage so you can continue using Testify offline as a guest.
								</p>
							</div>
						</div>

						<button
							type="button"
							onclick={() => confirmDelete('cloud_only')}
							disabled={isDeleting}
							class="neo-btn w-full py-2.5 px-3 bg-surface hover:bg-muted text-text-primary text-xs font-bold uppercase tracking-wider border-2 border-border-color shadow-[2px_2px_0px_var(--shadow-color)] flex items-center justify-center gap-2"
						>
							{#if isDeleting && selectedMode === 'cloud_only'}
								<span class="inline-block h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
								<span>Deleting Cloud Account...</span>
							{:else}
								<span>Delete Cloud Only & Stay Guest</span>
							{/if}
						</button>
					</div>

					<!-- Option 2: Delete Everything Everywhere -->
					<div
						class="neo-box p-4 bg-rose-500/5 border-2 border-rose-500/40 hover:border-rose-500 transition-colors space-y-2.5"
					>
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<span class="font-mono text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
									2. Delete Everything Everywhere
								</span>
								<span
									class="neo-badge bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/50 text-[9px] uppercase font-bold"
								>
									Irreversible Wipe
								</span>
							</div>
							<p class="font-mono text-xs text-text-muted leading-relaxed">
								Completely wipes your cloud account AND erases all test papers, exam histories, folders, and cached documents on this device. Everything will be gone.
							</p>
						</div>

						<button
							type="button"
							onclick={() => confirmDelete('everything')}
							disabled={isDeleting}
							class="neo-btn w-full py-2.5 px-3 bg-rose-500 text-white hover:bg-rose-600 border-rose-700 text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--shadow-color)] flex items-center justify-center gap-2"
						>
							{#if isDeleting && selectedMode === 'everything'}
								<span class="inline-block h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
								<span>Permanently Wiping Everything...</span>
							{:else}
								<span>Delete Everything Everywhere (Full Wipe)</span>
							{/if}
						</button>
					</div>
				</div>

				<!-- Cancel CTA -->
				<div class="pt-2 text-center">
					<button
						type="button"
						onclick={handleClose}
						disabled={isDeleting}
						class="font-mono text-xs text-text-muted hover:text-text-primary uppercase tracking-wider underline cursor-pointer"
					>
						Cancel & Keep Account
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
