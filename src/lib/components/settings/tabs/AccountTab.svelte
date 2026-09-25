<script lang="ts">
import { onMount } from 'svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

let newEmailInput = $state('');
let newPasswordInput = $state('');
let confirmPasswordInput = $state('');
let accountMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
let isUpdatingAccount = $state(false);
let cloudTelemetry = $state<{ testCount: number; attemptCount: number } | null>(null);

onMount(async () => {
	if (app.auth.isAuthenticated) {
		cloudTelemetry = await app.auth.getCloudTelemetry();
	}
});

async function handleUpdateEmail(e: SubmitEvent) {
	e.preventDefault();
	if (!newEmailInput.trim()) return;

	isUpdatingAccount = true;
	accountMessage = null;
	try {
		const res = await app.auth.updateEmail(newEmailInput.trim());
		if (res.error) {
			accountMessage = { type: 'error', text: res.error.message };
		} else {
			accountMessage = {
				type: 'success',
				text: res.message || 'Email update requested. Please check your inbox.',
			};
			newEmailInput = '';
		}
	} finally {
		isUpdatingAccount = false;
	}
}

async function handleUpdatePassword(e: SubmitEvent) {
	e.preventDefault();
	if (!newPasswordInput || newPasswordInput.length < 6) {
		accountMessage = {
			type: 'error',
			text: 'Password must be at least 6 characters.',
		};
		return;
	}
	if (newPasswordInput !== confirmPasswordInput) {
		accountMessage = { type: 'error', text: 'Passwords do not match.' };
		return;
	}

	isUpdatingAccount = true;
	accountMessage = null;
	try {
		const res = await app.auth.updatePassword(newPasswordInput);
		if (res.error) {
			accountMessage = { type: 'error', text: res.error.message };
		} else {
			accountMessage = {
				type: 'success',
				text: 'Password updated successfully!',
			};
			newPasswordInput = '';
			confirmPasswordInput = '';
		}
	} finally {
		isUpdatingAccount = false;
	}
}
</script>

<div class="neo-box p-4 sm:p-6 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] space-y-6">
	<div class="border-b-2 border-border-color pb-3">
		<h2 class="font-sans text-lg font-extrabold uppercase tracking-tight">
			Account & Cloud Synchronization
		</h2>
		<p class="font-mono text-xs text-text-muted">
			Manage your cloud credentials and cross-device sync status
		</p>
	</div>

	{#if accountMessage}
		<div
			class="neo-box p-3 font-mono text-xs {accountMessage.type === 'success'
				? 'bg-emerald-500/10 border-2 border-emerald-500 text-emerald-700 dark:text-emerald-300'
				: 'bg-rose-500/10 border-2 border-rose-500 text-rose-700 dark:text-rose-300'}"
		>
			{accountMessage.text}
		</div>
	{/if}

	{#if app.auth.isAuthenticated}
		<!-- Email Update Section -->
		<form onsubmit={handleUpdateEmail} class="neo-box p-4 bg-muted/20 border-2 border-border-color space-y-3">
			<div class="flex items-center justify-between">
				<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
					Primary Account Email
				</span>
				<span class="font-mono text-xs text-text-secondary font-bold underline">
					{app.auth.userEmail}
				</span>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
				<input
					type="email"
					bind:value={newEmailInput}
					placeholder="New email address..."
					required
					class="sm:col-span-2 neo-input text-xs font-mono py-2"
				/>
				<button
					type="submit"
					disabled={isUpdatingAccount || !newEmailInput.trim()}
					class="neo-btn bg-accent-contrast text-accent-contrast-text text-xs font-bold uppercase tracking-wider"
				>
					Change Email
				</button>
			</div>
			<p class="font-mono text-[11px] text-text-muted">
				A confirmation link will be sent to the new address before the update is applied.
			</p>
		</form>

		<!-- Password Update Section -->
		<form onsubmit={handleUpdatePassword} class="neo-box p-4 bg-muted/20 border-2 border-border-color space-y-3">
			<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
				Change Password
			</span>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<div>
					<label for="new-pw" class="font-mono text-[10px] uppercase text-text-muted block mb-1">
						New Password
					</label>
					<input
						id="new-pw"
						type="password"
						bind:value={newPasswordInput}
						minlength="6"
						placeholder="••••••••"
						required
						class="w-full neo-input text-xs font-mono py-2"
					/>
				</div>
				<div>
					<label for="confirm-pw" class="font-mono text-[10px] uppercase text-text-muted block mb-1">
						Confirm New Password
					</label>
					<input
						id="confirm-pw"
						type="password"
						bind:value={confirmPasswordInput}
						minlength="6"
						placeholder="••••••••"
						required
						class="w-full neo-input text-xs font-mono py-2"
					/>
				</div>
			</div>

			<button
				type="submit"
				disabled={isUpdatingAccount || !newPasswordInput}
				class="neo-btn bg-surface hover:bg-muted text-text-primary text-xs font-bold uppercase tracking-wider border-2 border-border-color shadow-[2px_2px_0px_var(--shadow-color)]"
			>
				Update Password
			</button>
		</form>

		<!-- Cloud Telemetry Card -->
		<div class="neo-box p-4 bg-muted/20 border-2 border-border-color space-y-3">
			<div class="flex items-center justify-between">
				<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
					Cloud Storage Telemetry
				</span>
				<button
					type="button"
					onclick={() => app.auth.syncNow()}
					class="neo-btn text-[11px] font-mono font-bold uppercase py-1 px-2.5 bg-accent-contrast text-accent-contrast-text"
				>
					Force Sync Now
				</button>
			</div>

			<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
				<div class="p-2.5 bg-surface border border-border-color">
					<span class="text-text-muted text-[10px] block">Cloud Tests</span>
					<span class="text-base font-bold">{cloudTelemetry?.testCount ?? '—'}</span>
				</div>
				<div class="p-2.5 bg-surface border border-border-color">
					<span class="text-text-muted text-[10px] block">Exam Attempts</span>
					<span class="text-base font-bold">{cloudTelemetry?.attemptCount ?? '—'}</span>
				</div>
				<div class="p-2.5 bg-surface border border-border-color col-span-2 sm:col-span-1">
					<span class="text-text-muted text-[10px] block">Sync Engine</span>
					<span class="text-base font-bold uppercase {app.auth.syncStatus === 'synced' ? 'text-emerald-500' : 'text-amber-500'}">
						{app.auth.syncStatus}
					</span>
				</div>
			</div>
		</div>

		<!-- Danger Zone: Account Deletion -->
		<div class="neo-box p-4 bg-rose-500/5 border-2 border-rose-500/40 space-y-3">
			<div class="flex items-center gap-2">
				<span class="h-2 w-2 rounded-full bg-rose-500"></span>
				<span class="font-mono text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
					Danger Zone: Delete Account
				</span>
			</div>
			<p class="font-mono text-xs text-text-muted leading-relaxed">
				Permanently delete your account. You will be prompted to choose whether to delete only your cloud data (keeping local papers on this device) or erase everything everywhere.
			</p>
			<button
				type="button"
				onclick={() => app.modals.openDeleteAccount()}
				class="neo-btn py-2 px-3.5 bg-rose-500 text-white hover:bg-rose-600 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_var(--shadow-color)]"
			>
				Delete Account...
			</button>
		</div>
	{:else}
		<!-- Guest Mode Notification -->
		<div class="neo-box p-4 sm:p-5 bg-muted/30 border-2 border-border-color space-y-3">
			<div class="flex items-center gap-2">
				<span class="h-2 w-2 rounded-full bg-amber-500"></span>
				<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
					Guest / Offline Mode Active
				</span>
			</div>
			<p class="font-mono text-xs text-text-secondary leading-relaxed">
				You are currently using Testify without an account. All your test papers, question diagrams, and exam history remain safely saved on this computer in your browser storage.
			</p>
			<p class="font-mono text-xs text-text-muted leading-relaxed">
				Signing in or creating an account unlocks seamless cross-device cloud sync with encrypted backups across your phone, tablet, and laptop.
			</p>
			<button
				type="button"
				onclick={() => app.modals.openAuth('signin')}
				class="neo-btn py-2.5 px-4 bg-accent-contrast text-accent-contrast-text text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--shadow-color)]"
			>
				Sign In or Create Account
			</button>
		</div>
	{/if}
</div>
