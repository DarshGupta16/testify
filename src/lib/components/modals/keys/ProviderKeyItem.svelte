<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { ProviderMetadata } from '$lib/types/apiKeys';

const {
	provider,
	isEditing = false,
	onstartedit,
	oncanceledit,
}: {
	provider: ProviderMetadata;
	isEditing?: boolean;
	onstartedit: () => void;
	oncanceledit: () => void;
} = $props();

const app = getAppContext();

let inputKey = $state('');
let showKey = $state(false);

const isConfigured = $derived(Boolean(app.apiKeys.configuredProviders[provider.id]));
const maskedKey = $derived(
	app.apiKeys.getMaskedKey(provider.id, app.security.isUnlocked, app.security.securityMode)
);

function handleStartEdit() {
	inputKey = app.apiKeys.getKey(provider.id) || '';
	showKey = false;
	onstartedit();
}

function handleCancelEdit() {
	inputKey = '';
	showKey = false;
	oncanceledit();
}

async function handleSaveKey() {
	const key = inputKey.trim();
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
		app.handleSaveKey(provider.id, key);
		inputKey = '';
		showKey = false;
		oncanceledit();
		app.toast.show(`${provider.name} API key saved successfully!`, 'success');
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Failed to save key';
		app.toast.show(message, 'error');
	}
}

function handleRemoveKey() {
	app.apiKeys.removeKey(provider.id);
	inputKey = '';
	showKey = false;
	if (isEditing) oncanceledit();
	app.toast.show(`${provider.name} key removed.`, 'info');
}
</script>

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
					onclick={handleStartEdit}
					class="neo-btn text-xs py-1 px-2.5"
				>
					Edit
				</button>
				<button
					type="button"
					onclick={handleRemoveKey}
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
					type={showKey ? 'text' : 'password'}
					bind:value={inputKey}
					placeholder={`Paste ${provider.name} key (${provider.placeholder})`}
					class="neo-input w-full text-xs font-mono py-2 pr-16"
					onkeydown={(e) => {
						if (e.key === 'Enter') handleSaveKey();
					}}
				/>
				<div class="absolute right-2 flex items-center gap-1">
					<button
						type="button"
						onclick={() => (showKey = !showKey)}
						class="p-1 font-mono text-[10px] text-text-muted hover:text-text-primary cursor-pointer"
						title={showKey ? 'Hide Key' : 'Show Key'}
					>
						{showKey ? 'Hide' : 'Show'}
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
							onclick={handleCancelEdit}
							class="neo-btn text-xs py-1.5 px-3"
						>
							Cancel
						</button>
					{/if}
					<button
						type="button"
						onclick={handleSaveKey}
						disabled={!inputKey?.trim()}
						class="neo-btn neo-btn-primary text-xs py-1.5 px-4 disabled:opacity-40"
					>
						{isEditing ? 'Update Key' : 'Save Key'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
