<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

// Input states
let newPasswordInput = $state('');
let confirmPasswordInput = $state('');
let showNewPassword = $state(false);
let showConfirmPassword = $state(false);
let passwordError = $state('');

function handleClose() {
	app.modals.closeMasterPassword();
	newPasswordInput = '';
	confirmPasswordInput = '';
	passwordError = '';
	showNewPassword = false;
	showConfirmPassword = false;
}

function handleKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape' && app.modals.isMasterPasswordModalOpen) {
		handleClose();
	}
}

async function handleSaveMasterPassword() {
	passwordError = '';
	const pwd = newPasswordInput.trim();
	const confirmPwd = confirmPasswordInput.trim();

	if (!pwd) {
		passwordError = 'Please enter a master password.';
		return;
	}
	if (pwd.length < 4) {
		passwordError = 'Password must be at least 4 characters.';
		return;
	}
	if (pwd !== confirmPwd) {
		passwordError = 'Passwords do not match.';
		return;
	}

	try {
		await app.handleSetMasterPassword(pwd);
		handleClose();
		app.toast.show('Master password set and Strict mode enabled.', 'success');
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Failed to set master password';
		passwordError = message;
	}
}

async function handleConfirmReset() {
	try {
		await app.handleResetMasterPassword();
		handleClose();
		app.toast.show('Master password and all encrypted keys have been reset.', 'warning');
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Failed to reset';
		app.toast.show(message, 'error');
	}
}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if app.modals.isMasterPasswordModalOpen}
	<div
		class="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="master-password-title"
	>
		<!-- Backdrop -->
		<button
			type="button"
			class="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity cursor-default"
			onclick={handleClose}
			aria-label="Close dialog background"
		></button>

		<!-- Dialog Box -->
		<div
			class="neo-box-lg relative z-10 w-full max-w-md bg-surface border-2 border-border-color shadow-[6px_6px_0px_var(--shadow-color)] animate-slide-down overflow-hidden p-4 sm:p-6 space-y-4"
		>
			{#if app.modals.masterPasswordModalMode === 'set'}
				<!-- Set Master Password Mode -->
				<div class="flex items-center justify-between border-b-2 border-border-color pb-3">
					<div class="flex items-center gap-2.5">
						<div class="flex h-7 w-7 items-center justify-center border-2 border-border-color bg-accent-contrast text-accent-contrast-text shadow-[1.5px_1.5px_0px_var(--shadow-color)]">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="square"
								class="h-4 w-4"
							>
								<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
								<path d="M7 11V7a5 5 0 0 1 10 0v4" />
							</svg>
						</div>
						<h3 id="master-password-title" class="font-sans text-sm font-extrabold uppercase tracking-tight text-text-primary">
							Set Master Password
						</h3>
					</div>
					<button
						type="button"
						onclick={handleClose}
						class="p-1 text-text-muted hover:text-text-primary text-xs"
						aria-label="Close dialog"
					>
						✕
					</button>
				</div>

				<!-- Explicit Security Warning Notice -->
				<div class="p-3 bg-amber-500/10 border-2 border-amber-500/40 space-y-1">
					<p class="font-sans text-xs font-bold text-amber-700 dark:text-amber-300">
						Important Security Notice
					</p>
					<p class="text-[11px] text-text-secondary leading-relaxed">
						If you forget your master password, your encrypted API keys cannot be recovered. In that case, all saved API keys and the master password itself will have to be deleted and reset.
					</p>
				</div>

				{#if passwordError}
					<div class="p-2 bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400 font-mono text-xs">
						{passwordError}
					</div>
				{/if}

				<div class="space-y-3">
					<div class="space-y-1">
						<label for="new-master-password" class="block font-mono text-[11px] font-bold uppercase text-text-secondary">
							Master Password
						</label>
						<div class="relative flex items-center">
							<input
								id="new-master-password"
								type={showNewPassword ? 'text' : 'password'}
								bind:value={newPasswordInput}
								placeholder="Enter master password..."
								class="neo-input w-full text-xs font-mono py-2 pr-16"
								onkeydown={(e) => {
									if (e.key === 'Enter') handleSaveMasterPassword();
								}}
							/>
							<button
								type="button"
								onclick={() => (showNewPassword = !showNewPassword)}
								class="absolute right-2 p-1 font-mono text-[10px] text-text-muted hover:text-text-primary"
							>
								{showNewPassword ? 'Hide' : 'Show'}
							</button>
						</div>
					</div>

					<div class="space-y-1">
						<label for="confirm-master-password" class="block font-mono text-[11px] font-bold uppercase text-text-secondary">
							Confirm Password
						</label>
						<div class="relative flex items-center">
							<input
								id="confirm-master-password"
								type={showConfirmPassword ? 'text' : 'password'}
								bind:value={confirmPasswordInput}
								placeholder="Confirm master password..."
								class="neo-input w-full text-xs font-mono py-2 pr-16"
								onkeydown={(e) => {
									if (e.key === 'Enter') handleSaveMasterPassword();
								}}
							/>
							<button
								type="button"
								onclick={() => (showConfirmPassword = !showConfirmPassword)}
								class="absolute right-2 p-1 font-mono text-[10px] text-text-muted hover:text-text-primary"
							>
								{showConfirmPassword ? 'Hide' : 'Show'}
							</button>
						</div>
					</div>
				</div>

				<div class="flex items-center justify-end gap-2 pt-2 border-t border-border-color/30">
					<button
						type="button"
						onclick={handleClose}
						class="neo-btn text-xs py-2 px-3"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={handleSaveMasterPassword}
						disabled={!newPasswordInput.trim() || !confirmPasswordInput.trim()}
						class="neo-btn neo-btn-primary text-xs py-2 px-4 disabled:opacity-40"
					>
						Save Password & Enable Strict
					</button>
				</div>
			{:else}
				<!-- Reset Master Password Mode -->
				<div class="flex items-center justify-between border-b-2 border-border-color pb-3">
					<h3 id="master-password-title" class="font-sans text-sm font-extrabold uppercase tracking-tight text-rose-600 dark:text-rose-400">
						Reset Master Password & Keys
					</h3>
					<button
						type="button"
						onclick={handleClose}
						class="p-1 text-text-muted hover:text-text-primary text-xs"
					>
						✕
					</button>
				</div>

				<p class="text-xs text-text-secondary leading-relaxed">
					This action will permanently delete all encrypted API keys and remove the master password, resetting the security mode to Lax. You will need to re-enter your API keys.
				</p>

				<div class="flex items-center justify-end gap-2 pt-2 border-t border-border-color/30">
					<button
						type="button"
						onclick={handleClose}
						class="neo-btn text-xs py-2 px-3"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={handleConfirmReset}
						class="neo-btn neo-btn-danger text-xs py-2 px-4"
					>
						Reset Everything
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
