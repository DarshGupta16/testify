<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import { AI_PROVIDERS, type AIProvider } from '$lib/types/apiKeys';
import ProviderKeyItem from './keys/ProviderKeyItem.svelte';
import SecurityModeControl from './keys/SecurityModeControl.svelte';

const app = getAppContext();

let editingProvider = $state<AIProvider | null>(null);

function handleClose() {
	app.modals.closeApiKeys();
	editingProvider = null;
}

function handleKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape' && app.modals.isApiKeysModalOpen) {
		handleClose();
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
			class="neo-box-lg relative z-10 flex max-h-[94vh] w-full max-w-2xl flex-col bg-surface border-2 border-border-color shadow-[6px_6px_0px_var(--shadow-color)] animate-slide-down overflow-hidden"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b-2 border-border-color bg-surface px-4 py-3.5 sm:px-6 sm:py-4">
				<div class="flex items-center gap-2.5 sm:gap-3">
					<div class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center border-2 border-border-color bg-accent-contrast text-accent-contrast-text shadow-[2px_2px_0px_var(--shadow-color)] shrink-0">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="square"
							class="h-4 w-4 sm:h-5 sm:w-5"
						>
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
							<path d="M7 11V7a5 5 0 0 1 10 0v4" />
						</svg>
					</div>
					<div>
						<h2 id="api-keys-modal-title" class="font-sans text-base sm:text-lg font-extrabold uppercase tracking-tight">
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
						class="neo-btn p-1.5 sm:p-2 text-text-muted hover:text-text-primary"
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
			<div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
				<!-- Security Level Control -->
				<SecurityModeControl />

				<!-- Providers List -->
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-secondary">
							AI Providers
						</span>
					</div>

					<div class="grid grid-cols-1 gap-3">
						{#each AI_PROVIDERS as provider (provider.id)}
							<ProviderKeyItem
								{provider}
								isEditing={editingProvider === provider.id}
								onstartedit={() => (editingProvider = provider.id)}
								oncanceledit={() => {
									if (editingProvider === provider.id) editingProvider = null;
								}}
							/>
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
