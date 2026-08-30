<script lang="ts">
import AiProviderSelector from '$lib/components/forms/AiProviderSelector.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';
import { AI_PROVIDERS, type AIProvider } from '$lib/types/apiKeys';

const app = getAppContext();

// Form State
let targetQuestionCount = $state<number>(10);
let durationMode = $state<'auto' | 'untimed' | 'custom'>('auto');
let durationMinutes = $state<number>(60);
let customInstructions = $state<string>('');
let selectedProvider = $state<AIProvider>('google');
let modelName = $state<string>('gemini-3.7-flash');
let formError = $state<string | null>(null);

let lastSourceTestId: string | null = null;

const PROMPT_SUGGESTIONS = [
	'Increase numerical question ratio',
	'Make questions more conceptual',
	'Emphasize multi-concept integration',
	'Add challenging derivation-style problems',
];

const currentProviderMeta = $derived(
	AI_PROVIDERS.find((p) => p.id === selectedProvider) || AI_PROVIDERS[0]
);

const isProviderReady = $derived.by(() => {
	const isConfigured = Boolean(app.apiKeys.configuredProviders[selectedProvider]);
	if (!isConfigured) return false;
	if (app.security.securityMode === 'strict' && !app.security.isUnlocked) return false;
	return true;
});

// Sync default form parameters whenever a new test is loaded into the modal
$effect(() => {
	if (app.modals.isSimilarPaperOpen && app.modals.similarPaperSourceTest) {
		const test = app.modals.similarPaperSourceTest;
		if (lastSourceTestId !== test.id) {
			lastSourceTestId = test.id;
			formError = null;

			// Initialize question count based on source test (no upper cap)
			const sourceCount = test.questions?.length || 10;
			targetQuestionCount = Math.max(1, sourceCount);

			// Initialize duration mode
			if (test.durationMinutes && test.durationMinutes > 0) {
				durationMode = 'custom';
				durationMinutes = test.durationMinutes;
			} else if (test.durationMinutes === null) {
				durationMode = 'untimed';
				durationMinutes = 60;
			} else {
				durationMode = 'auto';
				durationMinutes = 60;
			}

			customInstructions = '';

			// Select provider: prefer first configured or source test's provider
			if (app.apiKeys.configuredProviders[selectedProvider]) {
				// Keep current configured selection
			} else {
				const firstConfigured = AI_PROVIDERS.find((p) => app.apiKeys.configuredProviders[p.id]);
				if (firstConfigured) {
					selectedProvider = firstConfigured.id;
					modelName = firstConfigured.defaultModel;
				} else if (test.aiProvider) {
					selectedProvider = test.aiProvider;
					const meta = AI_PROVIDERS.find((p) => p.id === test.aiProvider);
					modelName = test.aiModel || meta?.defaultModel || 'gemini-3.7-flash';
				}
			}
		}
	} else if (!app.modals.isSimilarPaperOpen) {
		lastSourceTestId = null;
		formError = null;
	}
});

function handleClose() {
	app.modals.closeSimilarPaperModal();
}

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === 'Escape' && app.modals.isSimilarPaperOpen) {
		handleClose();
	}
}

function handleAddSuggestion(suggestion: string) {
	if (!customInstructions.trim()) {
		customInstructions = suggestion;
	} else if (!customInstructions.includes(suggestion)) {
		customInstructions = `${customInstructions.trim()}\n- ${suggestion}`;
	}
}

async function handleSubmit(e: SubmitEvent) {
	e.preventDefault();
	formError = null;

	const sourceTest = app.modals.similarPaperSourceTest;
	if (!sourceTest) {
		formError = 'No source assessment selected for blueprint generation.';
		return;
	}

	if (!app.network.isOnline) {
		formError =
			'You are currently offline. AI paper generation requires an active internet connection.';
		return;
	}

	// Validate Question Count (no upper limit)
	const count = Math.floor(Number(targetQuestionCount));
	if (isNaN(count) || count < 1) {
		formError = 'Target question count must be at least 1.';
		return;
	}

	// Validate API Key configured & unlocked
	if (!app.apiKeys.hasKey(selectedProvider)) {
		if (app.security.securityMode === 'strict' && !app.security.isUnlocked) {
			formError = `API keys are locked with your master password. Please unlock your keys first.`;
		} else {
			formError = `API key for ${selectedProvider.toUpperCase()} is not configured. Please set your key in settings.`;
		}
		return;
	}

	try {
		await app.handleCreateSimilarPaperJob({
			sourceTest,
			questionCount: count,
			durationMinutes: durationMode === 'custom' ? Number(durationMinutes) || 60 : null,
			autoDuration: durationMode === 'auto',
			isUntimed: durationMode === 'untimed',
			customInstructions: customInstructions.trim() || undefined,
			aiProvider: selectedProvider,
			aiModel: modelName.trim() || currentProviderMeta.defaultModel,
		});
	} catch (err) {
		formError = err instanceof Error ? err.message : String(err);
		console.error('[SimilarPaperModal] Submit error:', err);
	}
}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if app.modals.isSimilarPaperOpen && app.modals.similarPaperSourceTest}
	{@const source = app.modals.similarPaperSourceTest}

	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-xs animate-fade-in"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				handleClose();
			}
		}}
		role="presentation"
	>
		<!-- Modal Content Dialog -->
		<div
			class="neo-box-lg w-full max-w-3xl bg-surface p-4 sm:p-7 animate-slide-down max-h-[92vh] overflow-y-auto flex flex-col"
			role="dialog"
			aria-modal="true"
			aria-labelledby="similar-paper-modal-title"
		>
			<!-- Header -->
			<div class="flex items-start justify-between border-b-2 border-border-color pb-3 sm:pb-4 mb-4 shrink-0">
				<div class="flex items-center gap-2.5 sm:gap-3">
					<div
						class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center border-2 border-border-color bg-accent-contrast text-accent-contrast-text shadow-[2px_2px_0px_var(--shadow-color)] shrink-0 font-mono text-sm sm:text-base font-bold"
					>
						✨
					</div>
					<div>
						<h2
							id="similar-paper-modal-title"
							class="text-base sm:text-xl font-black uppercase tracking-tight text-text-primary"
						>
							Generate Similar Assessment
						</h2>
						<p class="font-mono text-xs text-text-muted">
							AI-powered paper blueprinting and synthetic question synthesis
						</p>
					</div>
				</div>

				<button
					type="button"
					onclick={handleClose}
					class="neo-btn text-xs py-1 px-2.5 ml-2 cursor-pointer"
					aria-label="Close modal"
				>
					✕
				</button>
			</div>

			<!-- Form -->
			<form onsubmit={handleSubmit} class="space-y-4 sm:space-y-5 flex-1">
				<!-- Source Paper Overview Card -->
				<div class="p-3.5 sm:p-4 bg-muted/30 border-2 border-border-color space-y-2.5">
					<div class="flex items-center justify-between">
						<span class="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted">
							Source Blueprint Assessment
						</span>
						<span class="neo-badge bg-accent-contrast text-accent-contrast-text text-[10px]">
							{app.subjects.getName(source.subjectId) || 'General'}
						</span>
					</div>

					<div>
						<h3 class="text-sm sm:text-base font-black text-text-primary uppercase tracking-tight line-clamp-1">
							{source.title}
						</h3>
					</div>

					<div class="grid grid-cols-3 gap-2 pt-2 border-t border-border-color/30 font-mono text-xs">
						<div>
							<span class="text-[10px] text-text-muted uppercase block">Questions</span>
							<span class="font-bold text-text-primary">{source.questions?.length || 0} Items</span>
						</div>
						<div>
							<span class="text-[10px] text-text-muted uppercase block">Duration</span>
							<span class="font-bold text-text-primary">
								{source.durationMinutes ? `${source.durationMinutes} Mins` : 'Untimed'}
							</span>
						</div>
						<div>
							<span class="text-[10px] text-text-muted uppercase block">Total Marks</span>
							<span class="font-bold text-text-primary">{source.totalMarks} Points</span>
						</div>
					</div>
				</div>

				<!-- Section: Generation Parameters (Question Count & Duration) -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<!-- 1. Question Count (No upper limit) -->
					<div class="space-y-1.5">
						<div class="flex items-center justify-between h-5">
							<label
								for="similar-question-count"
								class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary"
							>
								Target Questions
							</label>
							<span class="font-mono text-[10px] text-text-muted">
								Min: 1 • No upper limit
							</span>
						</div>

						<div class="relative">
							<input
								id="similar-question-count"
								type="number"
								min="1"
								required
								bind:value={targetQuestionCount}
								class="neo-input w-full h-10 text-sm font-mono bg-surface pr-14"
							/>
							<span
								class="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-text-muted pointer-events-none font-bold"
							>
								items
							</span>
						</div>
					</div>

					<!-- 2. Duration / Auto AI / Untimed / Custom -->
					<div class="space-y-1.5">
						<div class="flex items-center justify-between h-5">
							<label
								for="similar-duration"
								class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary"
							>
								Duration
							</label>
							<div class="flex items-center gap-2">
								<label class="flex items-center gap-1 cursor-pointer select-none">
									<input
										type="radio"
										name="durationMode"
										value="auto"
										checked={durationMode === 'auto'}
										onchange={() => (durationMode = 'auto')}
										class="accent-accent-contrast h-3.5 w-3.5"
									/>
									<span class="font-mono text-[11px] font-bold text-text-secondary">AI Decide</span>
								</label>
								<label class="flex items-center gap-1 cursor-pointer select-none">
									<input
										type="radio"
										name="durationMode"
										value="untimed"
										checked={durationMode === 'untimed'}
										onchange={() => (durationMode = 'untimed')}
										class="accent-accent-contrast h-3.5 w-3.5"
									/>
									<span class="font-mono text-[11px] font-bold text-text-secondary">Untimed</span>
								</label>
								<label class="flex items-center gap-1 cursor-pointer select-none">
									<input
										type="radio"
										name="durationMode"
										value="custom"
										checked={durationMode === 'custom'}
										onchange={() => (durationMode = 'custom')}
										class="accent-accent-contrast h-3.5 w-3.5"
									/>
									<span class="font-mono text-[11px] font-bold text-text-secondary">Custom</span>
								</label>
							</div>
						</div>

						<div class="relative">
							<input
								id="similar-duration"
								type="number"
								min="1"
								disabled={durationMode !== 'custom'}
								bind:value={durationMinutes}
								placeholder={durationMode === 'auto'
									? '⚡ AI will estimate duration based on questions'
									: durationMode === 'untimed'
										? '🌿 Untimed exam session'
										: '60'}
								class={`neo-input w-full h-10 text-sm font-mono pr-14 ${
									durationMode !== 'custom'
										? 'bg-muted/40 italic text-text-muted border-dashed'
										: 'bg-surface'
								}`}
							/>
							{#if durationMode === 'custom'}
								<span
									class="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-text-muted pointer-events-none font-bold"
								>
									mins
								</span>
							{/if}
						</div>
					</div>
				</div>

				<!-- Section: Custom Instructions & Suggestions -->
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<label
							for="similar-instructions"
							class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary"
						>
							Custom Directives & Syllabus Focus (Optional)
						</label>
						<span class="font-mono text-[10px] text-text-muted">
							Added to generation prompt
						</span>
					</div>

					<textarea
						id="similar-instructions"
						bind:value={customInstructions}
						rows="3"
						placeholder="e.g. Focus heavily on Kinetics, increase multi-concept numericals, or emphasize conceptual discrimination..."
						class="neo-input w-full text-xs font-mono p-2.5 bg-surface resize-none"
					></textarea>

					<!-- Suggestion Chips -->
					<div class="space-y-1.5 pt-0.5">
						<span class="font-mono text-[10px] font-bold uppercase text-text-muted block">
							Quick Directive Presets:
						</span>
						<div class="flex flex-wrap items-center gap-1.5">
							{#each PROMPT_SUGGESTIONS as suggestion}
								<button
									type="button"
									onclick={() => handleAddSuggestion(suggestion)}
									class="font-mono text-[10px] py-1 px-2 border border-border-color bg-surface hover:bg-muted/70 text-text-secondary hover:text-text-primary transition-colors cursor-pointer rounded-none flex items-center gap-1"
								>
									<span>+</span>
									<span>{suggestion}</span>
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Section: AI Provider & Model Selector -->
				<AiProviderSelector
					{selectedProvider}
					{modelName}
					onproviderchange={(p, m) => {
						selectedProvider = p;
						modelName = m;
					}}
					onmodelchange={(m) => {
						modelName = m;
					}}
				/>

				<!-- Error Alert Banner -->
				{#if formError}
					<div
						class="neo-box p-3 sm:p-4 bg-rose-500/10 border-2 border-rose-500 shadow-[3px_3px_0px_var(--shadow-color)] flex items-start gap-3 animate-fade-in"
					>
						<div
							class="flex h-6 w-6 shrink-0 items-center justify-center bg-rose-600 text-white font-mono text-xs font-black"
						>
							✕
						</div>
						<div class="space-y-0.5 text-xs">
							<p class="font-sans font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
								Cannot Enqueue Generation
							</p>
							<p class="text-text-primary leading-relaxed font-mono text-[11px]">
								{formError}
							</p>
						</div>
					</div>
				{/if}

				<!-- Actions Bar -->
				<div
					class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 sm:pt-4 border-t-2 border-border-color shrink-0"
				>
					<div class="font-mono text-xs text-text-muted text-center sm:text-left">
						<span>Ready to synthesize {targetQuestionCount} questions</span>
					</div>

					<div class="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
						<button
							type="button"
							onclick={handleClose}
							class="neo-btn text-xs h-10 px-4 text-center truncate cursor-pointer"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={!app.network.isOnline || !isProviderReady}
							class="neo-btn neo-btn-primary text-xs h-10 px-4 sm:px-6 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 font-black text-center truncate cursor-pointer shadow-[3px_3px_0px_var(--shadow-color)]"
							title={!app.network.isOnline
								? 'Cannot generate while offline'
								: !isProviderReady
									? 'Configure API key first'
									: 'Enqueue similar paper generation'}
						>
							<span>✨</span>
							<span>Generate Similar Paper &rarr;</span>
						</button>
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}
