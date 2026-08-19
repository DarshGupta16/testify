<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import { AI_PROVIDERS, type AIProvider } from '$lib/types/apiKeys';
import { DEFAULT_SUBJECT_IDS } from '$lib/types/subject';
import type { TestItem, TestUploadPayload } from '$lib/types/test';
import { formatBytes } from '$lib/utils';
import AiProviderSelector from './AiProviderSelector.svelte';
import PdfDropzone from './PdfDropzone.svelte';

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
let selectedSubjectId = $state(app.subjects.subjects[0]?.id || DEFAULT_SUBJECT_IDS.STEM);
let autoDuration = $state(false);
let durationMinutes = $state(60);
let formError = $state<string | null>(null);

// Ensure a valid subject ID is selected once subjects load
$effect(() => {
	if (!selectedSubjectId && app.subjects.subjects.length > 0) {
		selectedSubjectId = app.subjects.subjects[0].id;
	}
});

// AI Provider & Model Configuration
let selectedProvider = $state<AIProvider>('google');
let modelName = $state('gemini-3.7-flash');

const currentProviderMeta = $derived(
	AI_PROVIDERS.find((p) => p.id === selectedProvider) || AI_PROVIDERS[0]
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

function handleProviderChange(provider: AIProvider, defaultModel: string) {
	selectedProvider = provider;
	modelName = defaultModel;
}

function handleModelChange(model: string) {
	modelName = model;
}

// File state
let testFile = $state<{ name: string; size: number; formattedSize: string } | null>(null);
let testFileObj = $state<File | null>(null);

let answerKeyFile = $state<{ name: string; size: number; formattedSize: string } | null>(null);
let answerKeyFileObj = $state<File | null>(null);

function handleTestFileSelect(file: File) {
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

function handleAnswerKeyFileSelect(file: File) {
	answerKeyFileObj = file;
	answerKeyFile = {
		name: file.name,
		size: file.size,
		formattedSize: formatBytes(file.size),
	};
}

function clearTestFile() {
	testFile = null;
	testFileObj = null;
}

function clearAnswerKeyFile() {
	answerKeyFile = null;
	answerKeyFileObj = null;
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

	const payload: TestUploadPayload = {
		title: autoTitle
			? undefined
			: title.trim() || testFile.name.replace(/\.[^/.]+$/, '') || 'General Assessment',
		autoTitle,
		subjectId: selectedSubjectId || app.subjects.subjects[0]?.id || 'general',
		durationMinutes: autoDuration ? null : Number(durationMinutes) || 60,
		autoDuration,
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
		<!-- 1. Question Paper PDF -->
		<PdfDropzone
			id="form-test-file"
			label="1. Test / Assignment PDF"
			file={testFile}
			required={true}
			disabled={app.tests.isUploading}
			badgeText="PDF"
			badgeColor="bg-accent-contrast text-accent-contrast-text"
			subtitle="Exam sheets, practice tests (.pdf)"
			onchange={handleTestFileSelect}
			onclear={clearTestFile}
		/>

		<!-- 2. Answer Key PDF (Optional) -->
		<PdfDropzone
			id="form-key-file"
			label="2. Answer Key PDF"
			file={answerKeyFile}
			optionalBadge={true}
			disabled={app.tests.isUploading}
			badgeText="KEY"
			badgeColor="bg-emerald-500 text-white"
			subtitle="Enables instant auto-scoring"
			onchange={handleAnswerKeyFileSelect}
			onclear={clearAnswerKeyFile}
		/>
	</div>

	<!-- Scale Preset Selector -->
	<div class="p-3.5 bg-muted/30 border-2 border-border-color/60">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
			<div>
				<div class="flex items-center gap-1.5">
					<span class="inline-block h-2 w-2 bg-emerald-500 rounded-full"></span>
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
				class="neo-input text-xs font-mono py-1.5 px-2.5 bg-surface"
			>
				<option value={1.0}>1.0× (Standard - Compact)</option>
				<option value={1.25}>1.25× (Recommended for AI Vision)</option>
				<option value={1.5}>1.5× (High Resolution)</option>
				<option value={2.0}>2.0× (Ultra Crisp)</option>
			</select>
		</div>
	</div>

	<!-- Metadata Fields: Title, Subject, Duration -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t-2 border-border-color/20">
		<!-- 1. Assessment Title -->
		<div class="sm:col-span-3 space-y-1.5">
			<div class="flex items-center justify-between">
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
						✨ Auto-Detect from PDF
					</span>
				</label>
			</div>

			<input
				id="form-title"
				type="text"
				bind:value={title}
				disabled={app.tests.isUploading || autoTitle}
				placeholder={autoTitle ? 'Auto-detected from document header...' : 'e.g. Physics Midterm Examination 2026'}
				class={`neo-input w-full h-10 text-sm ${
					autoTitle ? 'bg-muted/40 italic text-text-muted border-dashed' : 'bg-surface'
				}`}
			/>
		</div>

		<!-- 2. Subject / Field Category -->
		<div class="space-y-1.5">
			<label for="form-subject" class="block font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
				Subject / Field
			</label>
			<select
				id="form-subject"
				bind:value={selectedSubjectId}
				disabled={app.tests.isUploading}
				class="neo-input w-full h-10 text-sm font-sans bg-surface"
			>
				{#each app.subjects.subjects as sub (sub.id)}
					<option value={sub.id}>{sub.name}</option>
				{/each}
			</select>
		</div>

		<!-- 3. Duration Input & Auto Mode -->
		<div class="sm:col-span-2 space-y-1.5">
			<div class="flex items-center justify-between">
				<label for="form-duration" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
					Exam Duration
				</label>
				<label class="flex items-center gap-1.5 cursor-pointer select-none">
					<input
						type="checkbox"
						bind:checked={autoDuration}
						disabled={app.tests.isUploading}
						class="accent-accent-contrast h-3.5 w-3.5"
					/>
					<span class="font-mono text-[11px] font-bold text-accent-contrast">
						✨ Let AI Decide (Auto)
					</span>
				</label>
			</div>

			<div class="relative h-10">
				<input
					id="form-duration"
					type="number"
					min="5"
					max="360"
					bind:value={durationMinutes}
					disabled={app.tests.isUploading || autoDuration}
					placeholder={autoDuration ? 'Auto-estimated by AI model...' : '60'}
					class={`neo-input w-full h-10 text-sm font-mono pr-14 ${
						autoDuration ? 'bg-muted/40 italic text-text-muted border-dashed' : 'bg-surface'
					}`}
				/>
				<span class="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-text-muted pointer-events-none">
					mins
				</span>
			</div>
		</div>
	</div>

	<!-- AI Provider & Vision Model Section -->
	<AiProviderSelector
		{selectedProvider}
		{modelName}
		disabled={app.tests.isUploading}
		onproviderchange={handleProviderChange}
		onmodelchange={handleModelChange}
	/>

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
	<div class="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t-2 border-border-color/20 mt-2">
		{#if isModal}
			<div class="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2 sm:gap-2.5 w-full">
				<button
					type="button"
					onclick={oncancel}
					disabled={app.tests.isUploading}
					class="neo-btn text-xs h-9 px-3 sm:px-4 disabled:opacity-40 text-center truncate"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={app.tests.isUploading}
					class="neo-btn neo-btn-primary text-xs h-9 px-3 sm:px-5 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 font-bold text-center truncate"
				>
					{#if app.tests.isUploading}
						<span class="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent animate-spin"></span>
						<span>Ingesting...</span>
					{:else}
						<span>Ingest & Create &rarr;</span>
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
