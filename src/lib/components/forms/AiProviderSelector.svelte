<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import { AI_PROVIDERS, type AIProvider } from '$lib/types/apiKeys';

const {
	selectedProvider = 'google',
	modelName = 'gemini-3.7-flash',
	disabled = false,
	onproviderchange,
	onmodelchange,
}: {
	selectedProvider: AIProvider;
	modelName: string;
	disabled?: boolean;
	onproviderchange: (provider: AIProvider, defaultModel: string) => void;
	onmodelchange: (model: string) => void;
} = $props();

const app = getAppContext();

const currentProviderMeta = $derived(
	AI_PROVIDERS.find((p) => p.id === selectedProvider) || AI_PROVIDERS[0]
);

const isSelectedProviderConfigured = $derived(
	Boolean(app.apiKeys.configuredProviders[selectedProvider])
);

function handleProviderSelect(e: Event) {
	const newProvider = (e.target as HTMLSelectElement).value as AIProvider;
	const meta = AI_PROVIDERS.find((p) => p.id === newProvider) || AI_PROVIDERS[0];
	onproviderchange(newProvider, meta.defaultModel);
}

function handleModelInput(e: Event) {
	const val = (e.target as HTMLInputElement).value;
	onmodelchange(val);
}

function handlePresetClick(preset: string) {
	onmodelchange(preset);
}
</script>

<div class="p-3.5 sm:p-4 bg-muted/30 border-2 border-border-color/70 space-y-3 sm:space-y-3.5">
	<!-- Section Header -->
	<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border-color/30 pb-2">
		<div class="flex items-center gap-2">
			<span class="inline-block h-2 w-2 bg-accent-contrast"></span>
			<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
				AI Engine & Vision Model
			</span>
		</div>

		<button
			type="button"
			onclick={() => app.modals.openApiKeys()}
			class="font-mono text-xs text-text-muted hover:text-text-primary underline cursor-pointer flex items-center gap-1"
		>
			<span>API Keys ({app.apiKeys.configuredCount} set)</span>
			<span>&rarr;</span>
		</button>
	</div>

	<!-- Zero Providers Configured or Strict Mode Locked Alert Banner -->
	{#if !app.apiKeys.hasAnyConfigured}
		<div class="neo-box p-3 bg-amber-500/10 border-2 border-amber-500/70 shadow-[2px_2px_0px_var(--shadow-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
			<div class="flex items-start gap-2.5">
				<div class="flex h-6 w-6 shrink-0 items-center justify-center bg-amber-500 text-black font-mono text-xs font-black">
					!
				</div>
				<div>
					<p class="font-sans text-xs font-extrabold uppercase tracking-wide text-amber-700 dark:text-amber-300">
						No AI Provider Configured
					</p>
					<p class="text-[11px] text-text-secondary mt-0.5">
						No API keys found. Configure a provider key to execute AI evaluation queries.
					</p>
				</div>
			</div>

			<button
				type="button"
				onclick={() => app.modals.openApiKeys()}
				class="neo-btn neo-btn-primary text-xs py-1.5 px-3 whitespace-nowrap self-start sm:self-auto shrink-0 flex items-center gap-1 cursor-pointer font-bold"
			>
				<span>Configure Key</span>
				<span class="font-mono">&rarr;</span>
			</button>
		</div>
	{:else if app.security.securityMode === 'strict' && !app.security.isUnlocked}
		<div class="neo-box p-3 bg-indigo-500/10 border-2 border-indigo-500/70 shadow-[2px_2px_0px_var(--shadow-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
			<div class="flex items-start gap-2.5">
				<div class="flex h-6 w-6 shrink-0 items-center justify-center bg-indigo-600 text-white font-mono text-xs font-black">
					🔒
				</div>
				<div>
					<p class="font-sans text-xs font-extrabold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
						API Keys Locked (Strict Mode)
					</p>
					<p class="text-[11px] text-text-secondary mt-0.5">
						Your API keys are encrypted and not in memory. You need to unlock your keys with your master password first.
					</p>
				</div>
			</div>

			<button
				type="button"
				onclick={() => app.modals.openApiKeys()}
				class="neo-btn neo-btn-primary text-xs py-1.5 px-3 whitespace-nowrap self-start sm:self-auto shrink-0 flex items-center gap-1 cursor-pointer font-bold"
			>
				<span>Unlock Keys</span>
				<span class="font-mono">&rarr;</span>
			</button>
		</div>
	{/if}

	<!-- Side-by-Side: Provider Dropdown & Model Name Input -->
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		<!-- 1. AI Provider Selection Dropdown -->
		<div class="space-y-1.5">
			<div class="flex items-center justify-between h-5">
				<label for="form-ai-provider" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
					Provider
				</label>
				{#if !isSelectedProviderConfigured}
					<button
						type="button"
						onclick={() => app.modals.openApiKeys()}
						class="font-mono text-[10px] uppercase text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1 font-bold"
						title="Open API Keys modal to enter key"
					>
						<span>⚠️ No Key</span>
						<span class="underline">Set Key &rarr;</span>
					</button>
				{:else if app.security.securityMode === 'strict' && !app.security.isUnlocked}
					<button
						type="button"
						onclick={() => app.modals.openApiKeys()}
						class="font-mono text-[10px] uppercase text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1 font-bold"
						title="Unlock API keys in memory with master password"
					>
						<span>🔒 Locked</span>
						<span class="underline">Unlock &rarr;</span>
					</button>
				{:else}
					<span class="font-mono text-[10px] uppercase text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
						<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
						Configured
					</span>
				{/if}
			</div>

			<select
				id="form-ai-provider"
				value={selectedProvider}
				onchange={handleProviderSelect}
				{disabled}
				class="neo-input w-full h-10 text-xs font-bold bg-surface"
			>
				{#each AI_PROVIDERS as provider (provider.id)}
					{@const isConfigured = app.apiKeys.configuredProviders[provider.id]}
					{@const isLocked = isConfigured && app.security.securityMode === 'strict' && !app.security.isUnlocked}
					<option value={provider.id}>
						{provider.name} {isConfigured ? (isLocked ? '🔒 (Locked)' : '✓ (Ready)') : '(No Key)'}
					</option>
				{/each}
			</select>
		</div>

		<!-- 2. Target Model Name Exact Input -->
		<div class="space-y-1.5">
			<div class="flex items-center justify-between h-5">
				<label for="form-ai-model" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
					Model Name
				</label>
				<span class="font-mono text-[10px] text-text-muted">
					Default: {currentProviderMeta.defaultModel}
				</span>
			</div>

			<input
				id="form-ai-model"
				type="text"
				list="provider-model-suggestions"
				value={modelName}
				oninput={handleModelInput}
				{disabled}
				placeholder={currentProviderMeta.defaultModel}
				class="neo-input w-full h-10 text-xs font-mono bg-surface"
			/>

			<datalist id="provider-model-suggestions">
				{#each currentProviderMeta.suggestedModels as sug}
					<option value={sug}></option>
				{/each}
			</datalist>
		</div>
	</div>

	<!-- Quick Model Preset Chips -->
	<div class="flex flex-wrap items-center gap-1.5 pt-0.5">
		<span class="font-mono text-[10px] text-text-muted uppercase font-bold mr-1">Presets:</span>
		{#each currentProviderMeta.suggestedModels as modelPreset}
			<button
				type="button"
				onclick={() => handlePresetClick(modelPreset)}
				{disabled}
				class={`font-mono text-[10px] px-2 py-0.5 border border-border-color transition-colors cursor-pointer ${
					modelName === modelPreset
						? 'bg-accent-contrast text-accent-contrast-text font-bold shadow-[1px_1px_0px_var(--shadow-color)]'
						: 'bg-surface hover:bg-muted text-text-secondary'
				}`}
			>
				{modelPreset}
			</button>
		{/each}
	</div>

	<!-- Sidenote / Multimodal capability notice -->
	{#if currentProviderMeta.visionNotice}
		<div class="p-2 bg-muted/50 border border-border-color/50 text-[11px] text-text-secondary font-mono flex items-start gap-1.5 animate-fade-in">
			<span class="text-accent-contrast font-bold">ℹ️ Note:</span>
			<span>{currentProviderMeta.visionNotice}</span>
		</div>
	{/if}
</div>
