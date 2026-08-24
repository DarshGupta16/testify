<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { SecurityMode } from '$lib/types/apiKeys';

const app = getAppContext();

let unlockPasswordInput = $state('');

async function handleUnlock() {
	if (!unlockPasswordInput.trim()) {
		app.toast.show('Please enter your master password.', 'warning');
		return;
	}

	try {
		const ok = await app.handleUnlock(unlockPasswordInput.trim());
		if (ok) {
			unlockPasswordInput = '';
			app.toast.show('API keys decrypted and loaded into memory (2h session).', 'success');
		}
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Invalid password or decryption failure';
		app.toast.show(message, 'error');
	}
}

function handleLock() {
	app.handleLock('Manually locked by user');
	unlockPasswordInput = '';
	app.toast.show('API keys purged from browser memory.', 'info');
}

async function requestModeSwitch(targetMode: SecurityMode) {
	if (targetMode === app.security.securityMode) return;

	if (targetMode === 'strict') {
		if (!app.security.hasMasterPassword) {
			app.modals.openSetMasterPassword();
			return;
		}
		try {
			await app.handleSwitchSecurityMode('strict');
			app.toast.show('Security mode switched to STRICT.', 'success');
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to switch mode';
			app.toast.show(message, 'error');
		}
	} else {
		try {
			await app.handleSwitchSecurityMode('lax');
			app.toast.show('Security mode switched to LAX.', 'success');
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to switch mode';
			app.toast.show(message, 'error');
		}
	}
}
</script>

<section class="neo-box p-3.5 sm:p-4 bg-muted/40 border-2 border-border-color space-y-3">
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
		<div class="flex flex-wrap items-center gap-2">
			<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
				Security Tier:
			</span>

			<!-- Security Level Segmented Toggle (Lax is default) -->
			<div class="inline-flex border-2 border-border-color bg-surface shadow-[2px_2px_0px_var(--shadow-color)]">
				<button
					type="button"
					onclick={() => requestModeSwitch('lax')}
					class={`px-2.5 sm:px-3 py-1 font-mono text-[11px] sm:text-xs font-bold uppercase transition-colors ${
						app.security.securityMode === 'lax'
							? 'bg-accent-contrast text-accent-contrast-text'
							: 'text-text-muted hover:text-text-primary hover:bg-muted'
					}`}
				>
					Lax (Plaintext)
				</button>
				<button
					type="button"
					onclick={() => requestModeSwitch('strict')}
					class={`px-2.5 sm:px-3 py-1 font-mono text-[11px] sm:text-xs font-bold uppercase transition-colors border-l-2 border-border-color ${
						app.security.securityMode === 'strict'
							? 'bg-accent-contrast text-accent-contrast-text'
							: 'text-text-muted hover:text-text-primary hover:bg-muted'
					}`}
				>
					Strict (Encrypted)
				</button>
			</div>
		</div>

		<!-- Actions / Session status -->
		<div class="flex items-center gap-2">
			{#if app.security.securityMode === 'strict' && app.security.isUnlocked}
				<span class="neo-badge text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40">
					<span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
					Session: {app.security.timeRemainingFormatted}
				</span>
				<button
					type="button"
					onclick={handleLock}
					class="neo-btn text-[10px] py-1 px-2 hover:bg-rose-500 hover:text-white"
					title="Wipe keys from browser memory immediately"
				>
					Lock Memory
				</button>
			{/if}
		</div>
	</div>

	<!-- Description -->
	<p class="text-xs text-text-secondary leading-relaxed">
		{#if app.security.securityMode === 'strict'}
			Strict mode encrypts your API keys with your master password, keeping them in memory for 2 hours before auto-locking.
		{:else}
			Lax mode keeps your API keys saved in browser storage for instant access across sessions without requiring a password.
		{/if}
	</p>

	<!-- Conditional Master Password Section in Strict Mode -->
	{#if app.security.securityMode === 'strict'}
		{#if !app.security.hasMasterPassword}
			<div class="pt-3 border-t border-border-color/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-surface/60 p-3">
				<div class="space-y-0.5">
					<p class="font-sans text-xs font-bold text-text-primary">
						Master Password Required
					</p>
					<p class="font-mono text-[11px] text-text-muted">
						Set a master password to encrypt and secure your credentials in Strict mode.
					</p>
				</div>
				<button
					type="button"
					onclick={() => app.modals.openSetMasterPassword()}
					class="neo-btn neo-btn-primary text-xs py-2 px-3.5 whitespace-nowrap self-start sm:self-auto"
				>
					Set Master Password
				</button>
			</div>
		{:else if !app.security.isUnlocked}
			<div class="pt-2 border-t border-border-color/30 space-y-2">
				<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
					<div class="relative flex-1">
						<input
							type="password"
							bind:value={unlockPasswordInput}
							placeholder="Enter master password to unlock keys..."
							class="neo-input w-full text-xs font-mono py-1.5"
							onkeydown={(e) => {
								if (e.key === 'Enter') handleUnlock();
							}}
						/>
					</div>

					<button
						type="button"
						onclick={handleUnlock}
						disabled={app.security.isBusy || !unlockPasswordInput}
						class="neo-btn neo-btn-primary text-xs py-1.5 px-4 disabled:opacity-50"
					>
						{#if app.security.isBusy}
							<span class="animate-spin text-xs">↻</span>
							<span>Deriving...</span>
						{:else}
							<span>Unlock Keys</span>
						{/if}
					</button>
				</div>

				<div class="flex items-center justify-end">
					<button
						type="button"
						onclick={() => app.modals.openResetMasterPassword()}
						class="font-mono text-[10px] text-text-muted hover:text-rose-500 underline cursor-pointer"
					>
						Forgot master password? Reset keys
					</button>
				</div>
			</div>
		{/if}
	{/if}
</section>
