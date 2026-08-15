<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import { AI_PROVIDERS, type AIProvider } from '$lib/types/apiKeys';
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
let subject = $state('STEM');
let autoDuration = $state(false);
let isUntimed = $state(false);
let durationMinutes = $state(60);
let formError = $state<string | null>(null);

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
		subject,
		durationMinutes: isUntimed ? null : autoDuration ? null : Number(durationMinutes) || 60,
		autoDuration,
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

<form onsubmit={handleSubmit} class="space-y-6">
	<!-- Dual File Pickers Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<!-- 1. Question Paper PDF -->
		<PdfDropzone
			id="form-test-file"
			label="1. Test / Assignment PDF"
			file={testFile}
			required={true}
			disabled={app.tests.isUploading}
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
			subtitle="Separate solution sheet (Optional)"
			onchange={handleAnswerKeyFileSelect}
			onclear={clearAnswerKeyFile}
		/>
	</div>

	<!-- Metadata Grid: Title, Subject, Duration -->
	<div class="space-y-4 pt-2 border-t border-border-color/20">
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<!-- Title Input -->
			<div class="md:col-span-2">
				<div class="flex items-center justify-between mb-1.5">
					<label for="form-title" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
						Assessment Title
					</label>
					<label class="flex items-center gap-1.5 font-mono text-[11px] text-text-muted cursor-pointer">
						<input
							type="checkbox"
							bind:checked={autoTitle}
							disabled={app.tests.isUploading}
							class="rounded-none border-2 border-border-color h-3.5 w-3.5"
						/>
						<span>Auto-Detect</span>
					</label>
				</div>
				<input
					id="form-title"
					type="text"
					bind:value={title}
					disabled={autoTitle || app.tests.isUploading}
					placeholder={autoTitle ? 'Will be extracted from document header...' : 'e.g. Physics Midterm Exam 2026'}
					class="neo-input w-full text-xs font-mono py-2 disabled:opacity-50 disabled:bg-muted"
				/>
			</div>

			<!-- Subject Category Dropdown -->
			<div>
				<label for="form-subject" class="block font-mono text-xs font-bold uppercase tracking-wider mb-1.5 text-text-primary">
					Subject Category
				</label>
				<select
					id="form-subject"
					bind:value={subject}
					disabled={app.tests.isUploading}
					class="neo-input w-full text-xs font-mono py-2"
				>
					<option value="STEM">STEM</option>
					<option value="Computer Science">Computer Science</option>
					<option value="Humanities">Humanities</option>
					<option value="Languages">Languages</option>
					<option value="General">General</option>
				</select>
			</div>
		</div>

		<!-- Duration Row -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<div class="flex items-center justify-between mb-1.5">
					<label for="form-duration" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
						Duration (Minutes)
					</label>
					<div class="flex items-center gap-3">
						<label class="flex items-center gap-1.5 font-mono text-[11px] text-text-muted cursor-pointer">
							<input
								type="checkbox"
								bind:checked={isUntimed}
								disabled={app.tests.isUploading}
								class="rounded-none border-2 border-border-color h-3.5 w-3.5"
							/>
							<span>Untimed</span>
						</label>
						<label class="flex items-center gap-1.5 font-mono text-[11px] text-text-muted cursor-pointer">
							<input
								type="checkbox"
								bind:checked={autoDuration}
								disabled={isUntimed || app.tests.isUploading}
								class="rounded-none border-2 border-border-color h-3.5 w-3.5"
							/>
							<span>Auto-Estimate</span>
						</label>
					</div>
				</div>
				<input
					id="form-duration"
					type="number"
					min="5"
					max="300"
					step="5"
					bind:value={durationMinutes}
					disabled={isUntimed || autoDuration || app.tests.isUploading}
					class="neo-input w-full text-xs font-mono py-2 disabled:opacity-50 disabled:bg-muted"
				/>
			</div>

			<!-- Extraction Scale -->
			<div>
				<div class="flex items-center justify-between mb-1.5">
					<label for="form-scale" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
						PDF Render Resolution
					</label>
					<span class="font-mono text-[10px] text-text-muted">
						Current: {app.selectedScale}x
					</span>
				</div>
				<div id="form-scale" class="grid grid-cols-4 gap-1.5">
					{#each [1.0, 1.25, 1.5, 2.0] as scaleOption}
						<button
							type="button"
							onclick={() => app.setScale(scaleOption)}
							disabled={app.tests.isUploading}
							class={`font-mono text-xs py-1.5 border-2 text-center transition-all ${
								app.selectedScale === scaleOption
									? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast font-bold'
									: 'bg-surface border-border-color/50 text-text-secondary hover:bg-muted'
							}`}
						>
							{scaleOption}x
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<!-- AI Provider & Model Sub-Component -->
	<div class="pt-2 border-t border-border-color/20">
		<AiProviderSelector
			{selectedProvider}
			{modelName}
			disabled={app.tests.isUploading}
			onproviderchange={handleProviderChange}
			onmodelchange={handleModelChange}
		/>
	</div>

	<!-- Upload Progress Bar -->
	{#if app.tests.isUploading}
		<div class="space-y-2 p-4 bg-muted/40 border-2 border-border-color animate-fade-in font-mono text-xs">
			<div class="flex items-center justify-between">
				<span class="font-bold uppercase text-text-primary">
					{app.tests.uploadStatusText || 'Processing Assessment...'}
				</span>
				<span class="font-bold text-accent-contrast">
					{app.tests.uploadProgress}%
				</span>
			</div>
			<div class="w-full bg-surface border-2 border-border-color h-4 p-0.5 overflow-hidden">
				<div
					class="bg-accent-contrast h-full transition-all duration-300 ease-out"
					style="width: {app.tests.uploadProgress}%"
				></div>
			</div>
		</div>
	{/if}

	<!-- Error Alert -->
	{#if formError}
		<div class="p-3 bg-rose-500/10 border-2 border-rose-500/50 text-rose-600 dark:text-rose-400 font-mono text-xs space-y-1 animate-fade-in">
			<span class="font-bold block uppercase">Assessment Ingestion Error</span>
			<p>{formError}</p>
		</div>
	{/if}

	<!-- Actions -->
	<div class="flex items-center justify-end gap-3 pt-2 border-t border-border-color/20">
		{#if isModal && oncancel}
			<button
				type="button"
				onclick={oncancel}
				disabled={app.tests.isUploading}
				class="neo-btn text-xs py-2 px-4 disabled:opacity-40"
			>
				Cancel
			</button>
		{/if}

		<button
			type="submit"
			disabled={app.tests.isUploading || !testFile}
			class="neo-btn neo-btn-primary text-xs py-2.5 px-6 disabled:opacity-40 flex items-center gap-2"
		>
			{#if app.tests.isUploading}
				<span class="inline-block animate-spin font-mono">↻</span>
				<span>Processing PDF & AI Synthesis...</span>
			{:else}
				<span>Digitize & Generate Assessment</span>
			{/if}
		</button>
	</div>
</form>
