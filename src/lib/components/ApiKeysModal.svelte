<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import { AI_PROVIDERS, type AIProvider, type SecurityMode } from '$lib/types/apiKeys';

const app = getAppContext();

// Input states for each provider
let inputKeys = $state<Record<AIProvider, string>>({
	openai: '',
	anthropic: '',
	google: '',
	groq: '',
});

let showKey = $state<Record<AIProvider, boolean>>({
	openai: false,
	anthropic: false,
	google: false,
	groq: false,
});

let editingProvider = $state<AIProvider | null>(null);
let unlockPasswordInput = $state('');

function handleClose() {
	app.modals.closeApiKeys();
	editingProvider = null;
	unlockPasswordInput = '';
}

function handleKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape' && app.modals.isApiKeysModalOpen) {
		handleClose();
	}
}

async function handleSaveKey(provider: AIProvider) {
	const key = inputKeys[provider]?.trim();
	if (!key) {
		app.toast.show('Please enter a valid API key.', 'warning');
		return;
	}

	if (app.security.securityMode === 'strict') {
		if (!app.security.hasMasterPassword) {
			app.modals.openSetMasterPassword();
			return;
		}
		if (!app.security.isUnlocked) {
			app.toast.show('Please unlock your session with your master password first.', 'warning');
			return;
		}
	}

	try {
		app.handleSaveKey(provider, key);
		inputKeys[provider] = '';
		editingProvider = null;
		app.toast.show(`${provider.toUpperCase()} API key saved successfully!`, 'success');
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Failed to save key';
		app.toast.show(message, 'error');
	}
}

function handleRemoveKey(provider: AIProvider) {
	app.apiKeys.removeKey(provider);
	inputKeys[provider] = '';
	if (editingProvider === provider) editingProvider = null;
	app.toast.show(`${provider.toUpperCase()} key removed.`, 'info');
}

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

<svelte:window onkeydown={handleKeyDown} />

{#if app.modals.isApiKeysModalOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="api-keys-modal-title"
	>
		<!-- Backdrop -->
		<button
			type="button"
			class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-default"
			onclick={handleClose}
			aria-label="Close modal background"
		></button>

		<!-- Modal Dialog -->
		<div
			class="neo-box-lg relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col bg-surface border-2 border-border-color shadow-[6px_6px_0px_var(--shadow-color)] animate-slide-down overflow-hidden"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b-2 border-border-color bg-surface px-5 py-4 sm:px-6">
				<div class="flex items-center gap-3">
					<div class="flex h-9 w-9 items-center justify-center border-2 border-border-color bg-accent-contrast text-accent-contrast-text shadow-[2px_2px_0px_var(--shadow-color)]">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="square"
							class="h-5 w-5"
						>
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
							<path d="M7 11V7a5 5 0 0 1 10 0v4" />
						</svg>
					</div>
					<div>
						<h2 id="api-keys-modal-title" class="font-sans text-lg font-extrabold uppercase tracking-tight">
							AI Provider Credentials
						</h2>
						<p class="font-mono text-xs text-text-muted">
							Configure API keys for test processing
						</p>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<span class="neo-badge text-[11px] hidden sm:inline-flex">
						{app.apiKeys.configuredCount} of {AI_PROVIDERS.length} Configured
					</span>
					<button
						type="button"
						onclick={handleClose}
						class="neo-btn p-2 text-text-muted hover:text-text-primary"
						aria-label="Close API Keys Modal"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="square"
							class="h-4 w-4"
						>
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Modal Body (Scrollable) -->
			<div class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
				<!-- Security Level Control Card -->
				<section class="neo-box p-4 bg-muted/40 border-2 border-border-color space-y-3">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div class="flex items-center gap-2">
							<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
								Security Tier:
							</span>

							<!-- Security Level Segmented Toggle (Lax is default) -->
							<div class="inline-flex border-2 border-border-color bg-surface shadow-[2px_2px_0px_var(--shadow-color)]">
								<button
									type="button"
									onclick={() => requestModeSwitch('lax')}
									class={`px-3 py-1 font-mono text-xs font-bold uppercase transition-colors ${
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
									class={`px-3 py-1 font-mono text-xs font-bold uppercase transition-colors border-l-2 border-border-color ${
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
							<!-- Master Password has NOT been set: Show setup banner, hide unlock input -->
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
							<!-- Master Password HAS been set: Show password unlock input -->
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
										class="font-mono text-[10px] text-text-muted hover:text-rose-500 underline"
									>
										Forgot master password? Reset keys
									</button>
								</div>
							</div>
						{/if}
					{/if}
				</section>

				<!-- Providers List -->
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-secondary">
							AI Providers
						</span>
					</div>

					<div class="grid grid-cols-1 gap-3">
						{#each AI_PROVIDERS as provider (provider.id)}
							{@const isConfigured = app.apiKeys.configuredProviders[provider.id]}
							{@const isEditing = editingProvider === provider.id}
							{@const maskedKey = app.apiKeys.getMaskedKey(provider.id, app.security.isUnlocked, app.security.securityMode)}

							<div
								class={`neo-box p-3.5 border-2 border-border-color transition-all ${
									isConfigured
										? 'bg-surface shadow-[3px_3px_0px_var(--shadow-color)]'
										: 'bg-surface/50 opacity-90'
								}`}
							>
								<div class="flex items-center justify-between gap-3 mb-2.5">
									<!-- Provider Header Info -->
									<div class="flex items-center gap-2.5">
										<div
											class="flex h-7 w-7 items-center justify-center font-mono text-xs font-black uppercase text-white shadow-[1.5px_1.5px_0px_var(--shadow-color)]"
											style={`background-color: ${provider.badgeBg}; border: 1.5px solid ${provider.badgeBorder};`}
										>
											{provider.name.slice(0, 2)}
										</div>
										<div class="flex items-center gap-2">
											<h3 class="font-sans text-sm font-bold text-text-primary">
												{provider.name}
											</h3>
											{#if isConfigured}
												<span class="neo-badge text-[10px] py-0 px-1.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40">
													✓ Configured
												</span>
											{:else}
												<span class="neo-badge text-[10px] py-0 px-1.5 bg-muted text-text-muted">
													Not Set
												</span>
											{/if}
										</div>
									</div>

									<!-- Docs Link -->
									<a
										href={provider.docsUrl}
										target="_blank"
										rel="noreferrer noopener"
										class="font-mono text-[10px] text-text-muted hover:text-text-primary underline"
										title={`Open ${provider.name} API Keys Console`}
									>
										Get Key ↗
									</a>
								</div>

								<!-- Key Status / Input Row -->
								{#if isConfigured && !isEditing}
									<div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2 bg-muted/30 border border-border-color/40">
										<div class="flex items-center gap-2 font-mono text-xs">
											<span class="text-text-muted text-[11px]">Key:</span>
											<span class="font-bold tracking-wider text-text-primary">
												{#if app.security.securityMode === 'strict' && !app.security.isUnlocked}
													<span class="text-text-muted italic">Encrypted</span>
												{:else}
													{maskedKey}
												{/if}
											</span>
										</div>

										<div class="flex items-center gap-2 justify-end">
											<button
												type="button"
												onclick={() => {
													editingProvider = provider.id;
													inputKeys[provider.id] = app.apiKeys.getKey(provider.id) || '';
												}}
												class="neo-btn text-xs py-1 px-2.5"
											>
												Edit
											</button>
											<button
												type="button"
												onclick={() => handleRemoveKey(provider.id)}
												class="neo-btn text-xs py-1 px-2.5 hover:bg-rose-500 hover:text-white"
											>
												Remove
											</button>
										</div>
									</div>
								{:else}
									<!-- Key Input Field -->
									<div class="space-y-2 pt-1">
										<div class="relative flex items-center">
											<input
												type={showKey[provider.id] ? 'text' : 'password'}
												bind:value={inputKeys[provider.id]}
												placeholder={`Paste ${provider.name} key (${provider.placeholder})`}
												class="neo-input w-full text-xs font-mono py-2 pr-16"
												onkeydown={(e) => {
													if (e.key === 'Enter') handleSaveKey(provider.id);
												}}
											/>
											<div class="absolute right-2 flex items-center gap-1">
												<button
													type="button"
													onclick={() => (showKey[provider.id] = !showKey[provider.id])}
													class="p-1 font-mono text-[10px] text-text-muted hover:text-text-primary"
													title={showKey[provider.id] ? 'Hide Key' : 'Show Key'}
												>
													{showKey[provider.id] ? 'Hide' : 'Show'}
												</button>
											</div>
										</div>

										<div class="flex items-center justify-between gap-2">
											<p class="text-[11px] text-text-muted font-mono">
												Prefix: <code class="font-bold text-text-secondary">{provider.keyPrefix}</code>
											</p>

											<div class="flex items-center gap-2">
												{#if isEditing}
													<button
														type="button"
														onclick={() => (editingProvider = null)}
														class="neo-btn text-xs py-1.5 px-3"
													>
														Cancel
													</button>
												{/if}
												<button
													type="button"
													onclick={() => handleSaveKey(provider.id)}
													disabled={!inputKeys[provider.id]?.trim()}
													class="neo-btn neo-btn-primary text-xs py-1.5 px-4 disabled:opacity-40"
												>
													{isEditing ? 'Update Key' : 'Save Key'}
												</button>
											</div>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-end border-t-2 border-border-color bg-surface px-5 py-3.5 sm:px-6">
				<button
					type="button"
					onclick={handleClose}
					class="neo-btn text-xs py-2 px-4 font-bold"
				>
					Done
				</button>
			</div>
		</div>
	</div>
{/if}
