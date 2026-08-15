<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import { AI_PROVIDERS, type AIProvider } from '$lib/types/apiKeys';
import type { TestItem, TestUploadPayload } from '$lib/types/test';
import { formatBytes } from '$lib/utils';

const {
	isModal = false,
	oncancel,
	onsuccess,
}: {
	isModal?: boolean;
	oncancel?: () => void;
	onsuccess?: (test?: TestItem) => void;
} = $props();

const app = getAppContext();

// Form State
let autoTitle = $state(false);
let title = $state('');
let subject = $state('STEM');
let durationMode = $state<'custom' | 'auto' | 'untimed'>('custom');
let durationMinutes = $state(60);
let formError = $state<string | null>(null);

// AI Provider & Model Configuration
let selectedProvider = $state<AIProvider>('google');
let modelName = $state('gemini-3.7-flash');

const currentProviderMeta = $derived(
	AI_PROVIDERS.find((p) => p.id === selectedProvider) || AI_PROVIDERS[0]
);

const isSelectedProviderConfigured = $derived(
	Boolean(app.apiKeys.configuredProviders[selectedProvider])
);

// Auto-switch to first configured provider if available and current isn't configured
$effect(() => {
	if (!app.apiKeys.configuredProviders[selectedProvider]) {
		const firstConfigured = AI_PROVIDERS.find((p) => app.apiKeys.configuredProviders[p.id]);
		if (firstConfigured) {
			selectedProvider = firstConfigured.id;
			modelName = firstConfigured.defaultModel;
		}
	}
});

function handleProviderChange(event: Event) {
	const newProvider = (event.target as HTMLSelectElement).value as AIProvider;
	selectedProvider = newProvider;
	const meta = AI_PROVIDERS.find((p) => p.id === newProvider);
	if (meta) {
		modelName = meta.defaultModel;
	}
}

let testFile = $state<{ name: string; size: number; formattedSize: string } | null>(null);
let testFileObj = $state<File | null>(null);

let answerKeyFile = $state<{ name: string; size: number; formattedSize: string } | null>(null);
let answerKeyFileObj = $state<File | null>(null);

let testInputRef = $state<HTMLInputElement | null>(null);
let answerKeyInputRef = $state<HTMLInputElement | null>(null);

function handleTestFileChange(event: Event) {
	const input = event.target as HTMLInputElement;
	if (input.files?.[0]) {
		const file = input.files[0];
		testFileObj = file;
		testFile = {
			name: file.name,
			size: file.size,
			formattedSize: formatBytes(file.size),
		};
		if (!title && !autoTitle) {
			title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
		}
	}
}

function handleAnswerKeyFileChange(event: Event) {
	const input = event.target as HTMLInputElement;
	if (input.files?.[0]) {
		const file = input.files[0];
		answerKeyFileObj = file;
		answerKeyFile = {
			name: file.name,
			size: file.size,
			formattedSize: formatBytes(file.size),
		};
	}
}

function clearTestFile() {
	testFile = null;
	testFileObj = null;
	if (testInputRef) testInputRef.value = '';
}

function clearAnswerKeyFile() {
	answerKeyFile = null;
	answerKeyFileObj = null;
	if (answerKeyInputRef) answerKeyInputRef.value = '';
}

async function handleSubmit(e: SubmitEvent) {
	e.preventDefault();

	if (!testFile || !testFileObj) {
		formError = 'Please choose a question paper PDF file to upload.';
		return;
	}

	if (!app.apiKeys.hasKey(selectedProvider)) {
		formError = `Please configure and save your ${selectedProvider.toUpperCase()} API key in settings before generating a test.`;
		return;
	}

	const isUntimed = durationMode === 'untimed';
	const isAutoDuration = durationMode === 'auto';

	const payload: TestUploadPayload = {
		title: autoTitle
			? undefined
			: title.trim() || testFile.name.replace(/\.[^/.]+$/, '') || 'General Assessment',
		autoTitle,
		subject,
		durationMinutes: isUntimed ? null : isAutoDuration ? null : Number(durationMinutes) || 60,
		autoDuration: isAutoDuration,
		isUntimed,
		scale: Number(app.selectedScale) || 1.25,
		aiProvider: selectedProvider,
		aiModel: modelName.trim() || currentProviderMeta.defaultModel,
		testFile: {
			...testFile,
			rawFile: testFileObj,
		},
		answerKeyFile: answerKeyFile
			? {
					...answerKeyFile,
					rawFile: answerKeyFileObj || undefined,
				}
			: null,
	};

	formError = null;

	try {
		const createdTest = await app.handleAddTest(payload);
		if (createdTest) {
			// Reset form fields
			title = '';
			autoTitle = false;
			clearTestFile();
			clearAnswerKeyFile();
			onsuccess?.(createdTest);
		}
	} catch (err) {
		formError = err instanceof Error ? err.message : String(err);
		console.error('[TestUploadForm] Assessment creation error:', err);
	}
}
</script>

<form onsubmit={handleSubmit} class="space-y-5">
	<!-- PDF Documents Header -->
	<div class="pb-1">
		<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">
			PDF Documents
		</span>
	</div>

	<!-- Dual File Pickers Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<!-- 1. Test Question Paper PDF -->
		<div class="flex flex-col">
			<label for="form-test-file" class="block font-mono text-xs font-bold uppercase tracking-wider mb-1.5 text-text-primary">
				1. Test / Assignment PDF <span class="text-rose-500">*</span>
			</label>

			<input
				id="form-test-file"
				type="file"
				accept=".pdf"
				bind:this={testInputRef}
				onchange={handleTestFileChange}
				class="hidden"
			/>

			{#if testFile}
				<div class="neo-box-sm p-3.5 flex items-center justify-between bg-muted/40">
					<div class="flex items-center gap-3 truncate pr-2">
						<div class="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-border-color bg-accent-contrast text-accent-contrast-text font-mono text-xs font-bold">
							PDF
						</div>
						<div class="truncate">
							<p class="text-xs font-bold truncate text-text-primary">{testFile.name}</p>
							<p class="font-mono text-[10px] text-text-muted">{testFile.formattedSize}</p>
						</div>
					</div>
					<button
						type="button"
						onclick={clearTestFile}
						disabled={app.tests.isUploading}
						class="neo-btn text-[10px] py-1 px-2 shrink-0 disabled:opacity-40"
						title="Remove file"
					>
						Clear
					</button>
				</div>
			{:else}
				<button
					type="button"
					onclick={() => testInputRef?.click()}
					disabled={app.tests.isUploading}
					class="w-full flex flex-col items-center justify-center border-2 border-dashed border-border-color p-5 text-center bg-surface hover:bg-muted/30 transition-colors cursor-pointer group disabled:opacity-50"
				>
					<div class="mb-2 flex h-9 w-9 items-center justify-center border-2 border-border-color bg-surface group-hover:translate-x-0.5 group-hover:translate-y-0.5 transition-transform">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="square"
							class="h-4 w-4"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="17 8 12 3 7 8" />
							<line x1="12" y1="3" x2="12" y2="15" />
						</svg>
					</div>
					<span class="text-xs font-bold uppercase tracking-wider text-text-primary">
						Select Test Paper PDF
					</span>
					<span class="font-mono text-[10px] text-text-muted mt-0.5">
						Exam sheets, practice tests (.pdf)
					</span>
				</button>
			{/if}
		</div>

		<!-- 2. Answer Key PDF (Optional) -->
		<div class="flex flex-col">
			<div class="flex items-center justify-between mb-1.5">
				<label for="form-key-file" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
					2. Answer Key PDF
				</label>
				<span class="font-mono text-[10px] uppercase text-text-muted bg-muted px-1.5 py-0.5 border border-border-color/40">
					Optional
				</span>
			</div>

			<input
				id="form-key-file"
				type="file"
				accept=".pdf"
				bind:this={answerKeyInputRef}
				onchange={handleAnswerKeyFileChange}
				class="hidden"
			/>

			{#if answerKeyFile}
				<div class="neo-box-sm p-3.5 flex items-center justify-between bg-muted/40">
					<div class="flex items-center gap-3 truncate pr-2">
						<div class="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-border-color bg-emerald-500 text-white font-mono text-xs font-bold">
							KEY
						</div>
						<div class="truncate">
							<p class="text-xs font-bold truncate text-text-primary">{answerKeyFile.name}</p>
							<p class="font-mono text-[10px] text-text-muted">{answerKeyFile.formattedSize}</p>
						</div>
					</div>
					<button
						type="button"
						onclick={clearAnswerKeyFile}
						disabled={app.tests.isUploading}
						class="neo-btn text-[10px] py-1 px-2 shrink-0 disabled:opacity-40"
						title="Remove answer key"
					>
						Clear
					</button>
				</div>
			{:else}
				<button
					type="button"
					onclick={() => answerKeyInputRef?.click()}
					disabled={app.tests.isUploading}
					class="w-full flex flex-col items-center justify-center border-2 border-dashed border-border-color p-5 text-center bg-surface hover:bg-muted/30 transition-colors cursor-pointer group disabled:opacity-50"
				>
					<div class="mb-2 flex h-9 w-9 items-center justify-center border-2 border-border-color bg-surface group-hover:translate-x-0.5 group-hover:translate-y-0.5 transition-transform">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="square"
							class="h-4 w-4"
						>
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
							<polyline points="14 2 14 8 20 8" />
							<line x1="9" y1="15" x2="15" y2="15" />
						</svg>
					</div>
					<span class="text-xs font-bold uppercase tracking-wider text-text-primary">
						Select Answer Key PDF
					</span>
					<span class="font-mono text-[10px] text-text-muted mt-0.5">
						Optional (AI will scan test PDF if omitted)
					</span>
				</button>
			{/if}
		</div>
	</div>

	<!-- Scale Preset Selector -->
	<div class="p-3.5 bg-muted/30 border-2 border-border-color/60">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-1.5">
					<span class="inline-block h-2 w-2 bg-emerald-500 rounded-full shrink-0"></span>
					<label for="form-scale-select" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
						Extraction Resolution Scale
					</label>
				</div>
				<p class="text-[11px] text-text-muted mt-0.5">
					Specifies rendering fidelity of full pages and vector diagram crops.
				</p>
			</div>

			<select
				id="form-scale-select"
				bind:value={app.selectedScale}
				disabled={app.tests.isUploading}
				class="neo-input text-xs font-mono py-1.5 px-3 bg-surface shrink-0 self-start sm:self-center"
			>
				<option value={1.0}>1.00× (Standard - Fast)</option>
				<option value={1.25}>1.25× (Recommended for AI Vision)</option>
				<option value={1.5}>1.50× (High Resolution)</option>
				<option value={2.0}>2.00× (Ultra Crisp)</option>
			</select>
		</div>
	</div>

	<!-- Assessment Metadata Fields -->
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t-2 border-border-color/20">
		<!-- Assessment Title with AI Detection Toggle -->
		<div class="sm:col-span-2 space-y-1.5">
			<div class="flex items-center justify-between h-5">
				<label for="form-title" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
					Assessment Title
				</label>
				<label class="flex items-center gap-1.5 cursor-pointer select-none">
					<input
						type="checkbox"
						bind:checked={autoTitle}
						disabled={app.tests.isUploading}
						class="accent-accent-contrast h-3.5 w-3.5"
					/>
					<span class="font-mono text-[11px] font-bold text-accent-contrast">
						✨ Let AI Decide (Auto-detect)
					</span>
				</label>
			</div>

			<input
				id="form-title"
				type="text"
				bind:value={title}
				disabled={app.tests.isUploading || autoTitle}
				placeholder={autoTitle ? 'Auto-detected from document headers by AI...' : 'e.g. Physics Midterm Examination 2026'}
				class={`neo-input w-full h-10 text-sm ${autoTitle ? 'bg-muted/40 italic text-text-muted border-dashed' : 'bg-surface'}`}
			/>
		</div>

		<!-- Subject / Domain -->
		<div class="space-y-1.5">
			<div class="flex items-center justify-between h-5">
				<label for="form-subject" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
					Subject / Field
				</label>
			</div>
			<select
				id="form-subject"
				bind:value={subject}
				disabled={app.tests.isUploading}
				class="neo-input w-full h-10 text-sm font-sans bg-surface"
			>
				<option value="STEM">STEM & Sciences</option>
				<option value="Computer Science">Computer Science</option>
				<option value="Humanities">Humanities & Social</option>
				<option value="Languages">Languages & Literature</option>
				<option value="General">General Assessment</option>
			</select>
		</div>

		<!-- Duration Controls: Custom / Auto / Untimed -->
		<div class="space-y-1.5">
			<div class="flex items-center justify-between h-5">
				<label for="form-duration" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary truncate">
					Duration
				</label>
				<div class="inline-flex items-center border border-border-color bg-surface overflow-hidden shrink-0">
					<button
						type="button"
						onclick={() => (durationMode = 'custom')}
						disabled={app.tests.isUploading}
						class={`font-mono text-[10px] px-2 py-0.5 transition-colors cursor-pointer ${
							durationMode === 'custom'
								? 'bg-accent-contrast text-accent-contrast-text font-bold'
								: 'hover:bg-muted text-text-muted'
						}`}
					>
						Set Mins
					</button>
					<button
						type="button"
						onclick={() => (durationMode = 'auto')}
						disabled={app.tests.isUploading}
						class={`font-mono text-[10px] px-2 py-0.5 border-x border-border-color transition-colors cursor-pointer ${
							durationMode === 'auto'
								? 'bg-accent-contrast text-accent-contrast-text font-bold'
								: 'hover:bg-muted text-text-muted'
						}`}
					>
						✨ Auto
					</button>
					<button
						type="button"
						onclick={() => (durationMode = 'untimed')}
						disabled={app.tests.isUploading}
						class={`font-mono text-[10px] px-2 py-0.5 transition-colors cursor-pointer ${
							durationMode === 'untimed'
								? 'bg-accent-contrast text-accent-contrast-text font-bold'
								: 'hover:bg-muted text-text-muted'
						}`}
					>
						Untimed
					</button>
				</div>
			</div>

			{#if durationMode === 'custom'}
				<div class="relative h-10">
					<input
						id="form-duration"
						type="number"
						min="5"
						max="360"
						bind:value={durationMinutes}
						disabled={app.tests.isUploading}
						class="neo-input w-full h-10 text-sm font-mono pr-14 bg-surface"
					/>
					<span class="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-text-muted pointer-events-none">
						mins
					</span>
				</div>
			{:else if durationMode === 'auto'}
				<div class="h-10 px-3 bg-muted/40 border border-dashed border-border-color text-xs font-mono text-text-secondary flex items-center gap-2">
					<span class="text-accent-contrast font-bold">✨</span>
					<span class="truncate">Estimated automatically by AI model.</span>
				</div>
			{:else}
				<div class="h-10 px-3 bg-muted/40 border border-dashed border-border-color text-xs font-mono text-text-secondary flex items-center gap-2">
					<span class="text-accent-contrast font-bold">♾️</span>
					<span>Untimed. No countdown timer.</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- AI Provider & Target Model Configuration -->
	<div class="p-4 bg-muted/30 border-2 border-border-color/70 space-y-3.5">
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
					onchange={handleProviderChange}
					disabled={app.tests.isUploading}
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
					bind:value={modelName}
					disabled={app.tests.isUploading}
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
					onclick={() => (modelName = modelPreset)}
					disabled={app.tests.isUploading}
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

	<!-- Error Alert Banner -->
	{#if formError}
		<div class="neo-box p-4 bg-rose-500/10 border-2 border-rose-500 shadow-[3px_3px_0px_var(--shadow-color)] flex items-start gap-3 animate-fade-in">
			<div class="flex h-7 w-7 shrink-0 items-center justify-center bg-rose-600 text-white font-mono text-sm font-black">
				✕
			</div>
			<div class="space-y-1 text-xs">
				<p class="font-sans font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
					Assessment Generation Failed
				</p>
				<p class="text-text-primary leading-relaxed font-mono text-[11px]">
					{formError}
				</p>
				<p class="font-mono text-[10px] text-text-muted pt-1">
					💡 Tip: Verify your API key, check model image limits (e.g. Groq max 3 images), or switch to Google Gemini.
				</p>
			</div>
		</div>
	{/if}

	<!-- Live AI & MuPDF Progress Bar -->
	{#if app.tests.isUploading}
		<div class="neo-box p-4 bg-muted/40 animate-slide-down border-2 border-border-color space-y-2">
			<div class="flex items-center justify-between text-xs font-mono font-bold">
				<span class="flex items-center gap-2 text-text-primary truncate">
					<span class="h-2.5 w-2.5 bg-accent-contrast animate-pulse"></span>
					<span class="truncate">{app.tests.uploadStatusText || 'Extracting pages & diagrams...'}</span>
				</span>
				<span class="font-mono text-accent-contrast ml-2">{app.tests.uploadProgress}%</span>
			</div>
			<div class="h-3 w-full border-2 border-border-color bg-surface overflow-hidden">
				<div
					class="h-full bg-accent-contrast transition-all duration-300 ease-out"
					style={`width: ${app.tests.uploadProgress}%`}
				></div>
			</div>
		</div>
	{/if}

	<!-- Form Action Buttons -->
	<div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t-2 border-border-color/20 mt-2">
		{#if isModal}
			<div class="flex items-center justify-end gap-2.5 w-full">
				<button
					type="button"
					onclick={oncancel}
					disabled={app.tests.isUploading}
					class="neo-btn text-xs h-9 px-4 disabled:opacity-40"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={app.tests.isUploading}
					class="neo-btn neo-btn-primary text-xs h-9 px-5 disabled:opacity-50 inline-flex items-center gap-1.5 font-bold"
				>
					{#if app.tests.isUploading}
						<span class="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent animate-spin"></span>
						<span>Ingesting PDF...</span>
					{:else}
						<span>Ingest & Create Test &rarr;</span>
					{/if}
				</button>
			</div>
		{:else}
			<div class="flex items-center justify-end w-full">
				<button
					type="submit"
					disabled={app.tests.isUploading}
					class="neo-btn neo-btn-primary text-sm py-3 px-6 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 font-bold"
				>
					{#if app.tests.isUploading}
						<span class="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent animate-spin"></span>
						<span>Ingesting PDF...</span>
					{:else}
						<span>Generate Test &rarr;</span>
					{/if}
				</button>
			</div>
		{/if}
	</div>
</form>
