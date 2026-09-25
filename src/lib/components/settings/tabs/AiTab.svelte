<script lang="ts">
import ToggleSwitch from '$lib/components/common/ToggleSwitch.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';
import { AI_PROVIDERS } from '$lib/types/apiKeys';

const app = getAppContext();

const selectedProviderMeta = $derived(
	AI_PROVIDERS.find((p) => p.id === app.settings.defaultAiProvider) || AI_PROVIDERS[0]
);

const DURATION_PRESETS = [30, 45, 60, 90, 120, 180];

const DIRECTIVE_PRESETS = [
	'Format all equations using clean KaTeX notation',
	'Provide thorough step-by-step mathematical derivations',
	'Emphasize conceptual discrimination and distractor analysis',
	'Increase numerical question ratio and dimensional checks',
	'Include comprehensive explanations for all answer options',
];
</script>

<div class="neo-box p-4 sm:p-6 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] space-y-6">
	<div class="border-b-2 border-border-color pb-3">
		<h2 class="font-sans text-lg font-extrabold uppercase tracking-tight">
			AI & Generation Defaults
		</h2>
		<p class="font-mono text-xs text-text-muted">
			Configure default providers, models, and custom prompts for PDF assessment generation
		</p>
	</div>

	<div class="space-y-4">
		<!-- Default Provider -->
		<div class="space-y-1.5">
			<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
				Default AI Provider
			</span>
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
				{#each AI_PROVIDERS as p (p.id)}
					<button
						type="button"
						onclick={() => {
							app.settings.setDefaultAiProvider(p.id);
							if (!p.suggestedModels.includes(app.settings.defaultAiModel)) {
								app.settings.setDefaultAiModel(p.defaultModel);
							}
						}}
						class="p-2.5 border-2 text-xs font-mono font-bold uppercase transition-all flex items-center justify-between {app.settings.defaultAiProvider === p.id
							? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)]'
							: 'bg-surface hover:bg-muted/50 border-border-color text-text-primary'}"
					>
						<span>{p.name}</span>
						{#if app.apiKeys.configuredProviders[p.id]}
							<span class="text-[9px] text-emerald-500 font-bold">✓ Key</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<!-- Default Model Name & Presets -->
		<div class="space-y-1.5">
			<div class="flex items-center justify-between">
				<label for="default-model" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
					Default Model Identifier
				</label>
				<span class="font-mono text-[10px] text-text-muted">
					Default: {selectedProviderMeta.defaultModel}
				</span>
			</div>
			<input
				id="default-model"
				type="text"
				list="settings-model-suggestions"
				value={app.settings.defaultAiModel}
				onchange={(e) => app.settings.setDefaultAiModel(e.currentTarget.value.trim())}
				placeholder={selectedProviderMeta.defaultModel}
				class="neo-input w-full text-xs font-mono py-2"
			/>
			<datalist id="settings-model-suggestions">
				{#each selectedProviderMeta.suggestedModels as sug}
					<option value={sug}></option>
				{/each}
			</datalist>

			<!-- Model Presets Chips -->
			<div class="flex flex-wrap items-center gap-1.5 pt-1">
				<span class="font-mono text-[10px] text-text-muted uppercase font-bold mr-1">Presets:</span>
				{#each selectedProviderMeta.suggestedModels as modelPreset}
					<button
						type="button"
						onclick={() => app.settings.setDefaultAiModel(modelPreset)}
						class="font-mono text-[10px] px-2 py-0.5 border border-border-color transition-colors cursor-pointer {app.settings.defaultAiModel === modelPreset
							? 'bg-accent-contrast text-accent-contrast-text font-bold shadow-[1px_1px_0px_var(--shadow-color)]'
							: 'bg-surface hover:bg-muted text-text-secondary'}"
					>
						{modelPreset}
					</button>
				{/each}
			</div>

			{#if selectedProviderMeta.visionNotice}
				<div class="p-2 bg-muted/50 border border-border-color/50 text-[11px] text-text-secondary font-mono flex items-start gap-1.5 mt-2">
					<span class="text-accent-contrast font-bold">ℹ️ Note:</span>
					<span>{selectedProviderMeta.visionNotice}</span>
				</div>
			{/if}
		</div>

		<!-- Default Duration & Untimed -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border-color/40">
			<div class="space-y-1.5">
				<label for="default-duration" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
					Default Exam Duration (Minutes)
				</label>
				<input
					id="default-duration"
					type="number"
					min="5"
					max="360"
					disabled={app.settings.defaultIsUntimed}
					value={app.settings.defaultDurationMinutes}
					onchange={(e) => app.settings.setDefaultDurationMinutes(Number(e.currentTarget.value))}
					class="neo-input w-full text-xs font-mono py-2 disabled:opacity-40"
				/>

				<!-- Duration Presets -->
				<div class="flex flex-wrap items-center gap-1.5 pt-1">
					<span class="font-mono text-[10px] text-text-muted uppercase font-bold mr-1">Presets:</span>
					{#each DURATION_PRESETS as mins}
						<button
							type="button"
							disabled={app.settings.defaultIsUntimed}
							onclick={() => app.settings.setDefaultDurationMinutes(mins)}
							class="font-mono text-[10px] px-2 py-0.5 border border-border-color transition-colors cursor-pointer disabled:opacity-30 {app.settings.defaultDurationMinutes === mins && !app.settings.defaultIsUntimed
								? 'bg-accent-contrast text-accent-contrast-text font-bold shadow-[1px_1px_0px_var(--shadow-color)]'
								: 'bg-surface hover:bg-muted text-text-secondary'}"
						>
							{mins}m
						</button>
					{/each}
				</div>
			</div>

			<div class="flex items-center gap-3 pt-6">
				<ToggleSwitch
					id="untimed-toggle"
					ariaLabel="Default to Untimed Practice"
					checked={app.settings.defaultIsUntimed}
					onchange={(checked) => app.settings.setDefaultIsUntimed(checked)}
				/>
				<label for="untimed-toggle" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary cursor-pointer select-none">
					Default to Untimed Practice
				</label>
			</div>
		</div>

		<!-- Auto-generate Title -->
		<div class="flex items-center justify-between pt-3 border-t border-border-color/40">
			<div class="space-y-0.5">
				<label for="auto-title-toggle" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block cursor-pointer select-none">
					Auto-Generate Test Titles
				</label>
				<p class="font-mono text-[11px] text-text-muted">
					Automatically infer clean assessment titles from PDF headers
				</p>
			</div>
			<ToggleSwitch
				id="auto-title-toggle"
				ariaLabel="Auto-Generate Test Titles"
				checked={app.settings.autoTitleDefault}
				onchange={(checked) => app.settings.setAutoTitleDefault(checked)}
			/>
		</div>

		<!-- Global Custom Prompt Instructions & Presets -->
		<div class="space-y-1.5 pt-3 border-t border-border-color/40">
			<label for="custom-inst" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
				Global System Instructions Template
			</label>
			<textarea
				id="custom-inst"
				rows="3"
				value={app.settings.globalCustomInstructions}
				onchange={(e) => app.settings.setGlobalCustomInstructions(e.currentTarget.value)}
				placeholder="e.g. Always format equations using KaTeX notation. Include detailed step-by-step solutions for mathematics questions..."
				class="neo-input w-full text-xs font-mono p-2.5 resize-y"
			></textarea>
			<p class="font-mono text-[10px] text-text-muted">
				These instructions are automatically appended to all PDF testify and similar paper generation requests.
			</p>

			<!-- Quick Directive Presets -->
			<div class="space-y-1.5 pt-1">
				<div class="flex items-center justify-between">
					<span class="font-mono text-[10px] font-bold uppercase text-text-muted block">
						Quick Directive Presets:
					</span>
					{#if app.settings.globalCustomInstructions}
						<button
							type="button"
							onclick={() => app.settings.setGlobalCustomInstructions('')}
							class="font-mono text-[10px] text-rose-500 hover:underline cursor-pointer uppercase font-bold"
						>
							Clear All
						</button>
					{/if}
				</div>
				<div class="flex flex-wrap items-center gap-1.5">
					{#each DIRECTIVE_PRESETS as suggestion}
						<button
							type="button"
							onclick={() => {
								const current = app.settings.globalCustomInstructions.trim();
								if (!current) {
									app.settings.setGlobalCustomInstructions(suggestion);
								} else if (!current.includes(suggestion)) {
									app.settings.setGlobalCustomInstructions(`${current}\n- ${suggestion}`);
								}
							}}
							class="font-mono text-[10px] py-1 px-2 border border-border-color bg-surface hover:bg-muted/70 text-text-secondary hover:text-text-primary transition-colors cursor-pointer flex items-center gap-1"
						>
							<span>+</span>
							<span>{suggestion}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
