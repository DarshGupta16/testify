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

const currentMeta = $derived(
	AI_PROVIDERS.find((p) => p.id === selectedProvider) || AI_PROVIDERS[0]
);

const isConfigured = $derived(Boolean(app.apiKeys.configuredProviders[selectedProvider]));

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

<div class="space-y-4">
	<!-- AI Engine Configuration Header -->
	<div class="flex items-center justify-between">
		<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">
			AI Engine & Vision Model
		</span>
		<button
			type="button"
			onclick={() => app.modals.openApiKeys()}
			class="font-mono text-[11px] text-accent-contrast underline hover:opacity-80"
		>
			Manage API Keys ({app.apiKeys.configuredCount}/4 Configured)
		</button>
	</div>

	<!-- AI Provider & Model Inputs Row -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<!-- 1. Provider Select -->
		<div>
			<label for="ai-provider-select" class="block font-mono text-xs font-bold uppercase tracking-wider mb-1.5 text-text-primary">
				AI Provider
			</label>
			<select
				id="ai-provider-select"
				value={selectedProvider}
				onchange={handleProviderSelect}
				{disabled}
				class="neo-input w-full text-xs font-mono py-2"
			>
				{#each AI_PROVIDERS as provider}
					<option value={provider.id}>
						{provider.name} {#if app.apiKeys.configuredProviders[provider.id]}✓ (Key Active){:else}⚠ (No Key){/if}
					</option>
				{/each}
			</select>
		</div>

		<!-- 2. Model Identifier -->
		<div>
			<div class="flex items-center justify-between mb-1.5">
				<label for="ai-model-input" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
					Model Name
				</label>
				<span class="font-mono text-[10px] text-text-muted">
					Default: {currentMeta.defaultModel}
				</span>
			</div>
			<input
				id="ai-model-input"
				type="text"
				value={modelName}
				oninput={handleModelInput}
				placeholder={currentMeta.defaultModel}
				{disabled}
				class="neo-input w-full text-xs font-mono py-2"
			/>
		</div>
	</div>

	<!-- Suggested Model Presets Chips -->
	{#if currentMeta.suggestedModels && currentMeta.suggestedModels.length > 0}
		<div class="flex flex-wrap items-center gap-1.5 pt-1">
			<span class="font-mono text-[10px] text-text-muted uppercase font-bold mr-1">
				Presets:
			</span>
			{#each currentMeta.suggestedModels as preset}
				<button
					type="button"
					onclick={() => handlePresetClick(preset)}
					{disabled}
					class={`font-mono text-[10px] px-2 py-0.5 border cursor-pointer transition-all ${
						modelName === preset
							? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast font-bold'
							: 'bg-muted/50 border-border-color/40 text-text-secondary hover:bg-muted'
					}`}
				>
					{preset}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Vision Limitation Notice (e.g. Groq 3 images limit) -->
	{#if currentMeta.visionNotice}
		<div class="p-2.5 bg-amber-500/10 border border-amber-500/40 font-mono text-[11px] text-amber-700 dark:text-amber-300">
			{currentMeta.visionNotice}
		</div>
	{/if}

	<!-- Missing API Key Alert Banner -->
	{#if !isConfigured}
		<div class="p-3 bg-rose-500/10 border-2 border-rose-500/40 flex items-center justify-between gap-3">
			<div class="flex items-center gap-2">
				<span class="text-rose-500 font-bold font-mono text-sm">⚠️</span>
				<div>
					<p class="font-sans text-xs font-bold text-rose-600 dark:text-rose-400">
						{currentMeta.name} API Key Not Configured
					</p>
					<p class="font-mono text-[10px] text-text-muted">
						Please add your API key to create assessments with this provider.
					</p>
				</div>
			</div>
			<button
				type="button"
				onclick={() => app.modals.openApiKeys()}
				class="neo-btn neo-btn-primary text-[10px] py-1 px-2.5 shrink-0"
			>
				Add Key
			</button>
		</div>
	{/if}
</div>
