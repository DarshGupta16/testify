<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import { AI_PROVIDERS, type AIProvider } from '$lib/types/apiKeys';
import type { BatchGenerationConfig, BatchUploadItem, QueueMode } from '$lib/types/queue';
import { DEFAULT_SUBJECT_IDS } from '$lib/types/subject';
import { formatBytes } from '$lib/utils';
import AiProviderSelector from './AiProviderSelector.svelte';
import BatchPaperList, { type BatchFormEntry } from './BatchPaperList.svelte';
import PdfDropzone from './PdfDropzone.svelte';
import QueueConfigBar from './QueueConfigBar.svelte';

const {
	isModal = false,
	oncancel,
	onsuccess,
}: {
	isModal?: boolean;
	oncancel?: () => void;
	onsuccess?: () => void;
} = $props();

const app = getAppContext();

// Batch Items State
let batchItems = $state<BatchFormEntry[]>([]);
let selectedSubjectId = $state(app.subjects.subjects[0]?.id || DEFAULT_SUBJECT_IDS.STEM);
let autoDuration = $state(false);
let durationMinutes = $state(60);
let globalAutoTitle = $state(false);
let formError = $state<string | null>(null);

// Queue Mode & Concurrency Settings
let queueMode = $state<QueueMode>(app.queue.mode || 'sequential');
let concurrencyValue = $state<number>(app.queue.concurrency || 1);

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

// Auto-switch to first configured provider if current isn't configured
$effect(() => {
	if (!app.apiKeys.configuredProviders[selectedProvider]) {
		const firstConfigured = AI_PROVIDERS.find((p) => app.apiKeys.configuredProviders[p.id]);
		if (firstConfigured) {
			selectedProvider = firstConfigured.id;
			modelName = firstConfigured.defaultModel;
		}
	}
});

function handlePrimaryFilesSelect(files: File[]) {
	formError = null;
	const newEntries: BatchFormEntry[] = files.map((file, idx) => ({
		id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${idx}`,
		title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
		autoTitle: globalAutoTitle,
		testFile: {
			name: file.name,
			size: file.size,
			formattedSize: formatBytes(file.size),
			rawFile: file,
		},
		answerKeyFile: null,
	}));

	batchItems = [...batchItems, ...newEntries];
}

function handleRemoveBatchItem(id: string) {
	batchItems = batchItems.filter((item) => item.id !== id);
}

function handleToggleTitle(id: string, autoTitle: boolean) {
	batchItems = batchItems.map((item) => (item.id === id ? { ...item, autoTitle } : item));
}

function handleSelectKey(id: string, file: File) {
	batchItems = batchItems.map((item) =>
		item.id === id
			? {
					...item,
					answerKeyFile: {
						name: file.name,
						size: file.size,
						formattedSize: formatBytes(file.size),
						rawFile: file,
					},
				}
			: item
	);
}

function handleRemoveKey(id: string) {
	batchItems = batchItems.map((item) => (item.id === id ? { ...item, answerKeyFile: null } : item));
}

async function handleSubmit(e: SubmitEvent) {
	e.preventDefault();

	if (batchItems.length === 0) {
		formError = 'Please choose or drop at least one question paper PDF.';
		return;
	}

	if (!app.network.isOnline) {
		formError = 'You are currently offline. AI test generation requires an active internet connection.';
		return;
	}

	if (!app.apiKeys.hasKey(selectedProvider)) {
		formError = `Please configure and save your ${selectedProvider.toUpperCase()} API key in settings before generating a test.`;
		return;
	}

	const batchPayloads: BatchUploadItem[] = batchItems.map((item) => ({
		id: item.id,
		title: item.autoTitle ? '' : item.title.trim() || item.testFile.name.replace(/\.[^/.]+$/, ''),
		autoTitle: item.autoTitle,
		testFile: item.testFile,
		answerKeyFile: item.answerKeyFile,
	}));

	const config: BatchGenerationConfig = {
		subjectId: selectedSubjectId || app.subjects.subjects[0]?.id || 'general',
		aiProvider: selectedProvider,
		aiModel: modelName.trim() || currentProviderMeta.defaultModel,
		scale: Number(app.selectedScale) || 1.25,
		durationMinutes: autoDuration ? null : Number(durationMinutes) || 60,
		autoDuration,
		isUntimed: false,
		mode: queueMode,
		concurrency: queueMode === 'sequential' ? 1 : Math.max(1, Math.floor(concurrencyValue) || 1),
	};

	try {
		await app.queue.enqueueBatch(batchPayloads, config);
		app.toast.show(
			`Enqueued ${batchPayloads.length} ${batchPayloads.length === 1 ? 'paper' : 'papers'} for background generation!`,
			'info'
		);
		app.queue.toggleDrawer(true);
		batchItems = [];
		onsuccess?.();
	} catch (err) {
		formError = err instanceof Error ? err.message : String(err);
		console.error('[TestUploadForm] Enqueue error:', err);
	}
}
</script>

<form onsubmit={handleSubmit} class="space-y-5">
	<!-- 1. Question Papers Ingestion -->
	<div class="space-y-3">
		<div class="flex items-center justify-between pb-1">
			<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">
				1. Question Paper PDFs ({batchItems.length} selected)
			</span>
			{#if batchItems.length > 0}
				<button
					type="button"
					onclick={() => (batchItems = [])}
					class="text-[11px] font-mono text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
				>
					Clear All ({batchItems.length})
				</button>
			{/if}
		</div>

		<PdfDropzone
			id="form-batch-test-files"
			label="Question Paper PDF(s)"
			multiple={true}
			subtitle="Drop 1 or multiple exam papers (.pdf) to generate in parallel or sequentially"
			onfileschange={handlePrimaryFilesSelect}
			onchange={(f) => handlePrimaryFilesSelect([f])}
		/>

		{#if batchItems.length > 0}
			<BatchPaperList
				items={batchItems}
				onremoveitem={handleRemoveBatchItem}
				ontoggletitle={handleToggleTitle}
				onselectkey={handleSelectKey}
				onremovekey={handleRemoveKey}
			/>
		{/if}
	</div>

	<!-- 2. Queue Mode & Concurrency Bar -->
	<QueueConfigBar bind:mode={queueMode} bind:concurrency={concurrencyValue} />

	<!-- 3. Extraction Resolution Scale -->
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
				class="neo-input text-xs font-mono py-1.5 px-2.5 bg-surface"
			>
				<option value={1.0}>1.0× (Standard - Compact)</option>
				<option value={1.25}>1.25× (Recommended for AI Vision)</option>
				<option value={1.5}>1.5× (High Resolution)</option>
				<option value={2.0}>2.0× (Ultra Crisp)</option>
			</select>
		</div>
	</div>

	<!-- 4. Metadata: Subject & Duration -->
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t-2 border-border-color/20">
		<div class="space-y-1.5">
			<label for="form-subject" class="block font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
				Academic Subject
			</label>
			<select
				id="form-subject"
				bind:value={selectedSubjectId}
				class="neo-input w-full h-10 text-sm font-sans bg-surface"
			>
				{#each app.subjects.subjects as sub (sub.id)}
					<option value={sub.id}>{sub.name}</option>
				{/each}
			</select>
		</div>

		<div class="space-y-1.5">
			<div class="flex items-center justify-between">
				<label for="form-duration" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
					Default Duration
				</label>
				<label class="flex items-center gap-1.5 cursor-pointer select-none">
					<input
						type="checkbox"
						bind:checked={autoDuration}
						class="accent-accent-contrast h-3.5 w-3.5"
					/>
					<span class="font-mono text-[11px] font-bold text-accent-contrast">
						✨ AI Auto-Estimate
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
					disabled={autoDuration}
					placeholder={autoDuration ? 'Auto-estimated by AI...' : '60'}
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

	<!-- 5. AI Provider & Model -->
	<AiProviderSelector
		{selectedProvider}
		{modelName}
		onproviderchange={(p, m) => { selectedProvider = p; modelName = m; }}
		onmodelchange={(m) => { modelName = m; }}
	/>

	<!-- 6. Alerts -->
	{#if !app.network.isOnline}
		<div class="neo-box p-4 bg-amber-500/15 border-2 border-amber-500 shadow-[3px_3px_0px_var(--shadow-color)] flex items-start gap-3 animate-fade-in">
			<div class="flex h-7 w-7 shrink-0 items-center justify-center bg-amber-500 text-white font-mono text-sm font-black">
				⚡
			</div>
			<div class="space-y-1 text-xs">
				<p class="font-sans font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
					Offline Mode Active
				</p>
				<p class="text-text-primary leading-relaxed">
					AI test generation requires an active internet connection. You can still practice existing tests offline.
				</p>
			</div>
		</div>
	{/if}

	{#if formError}
		<div class="neo-box p-4 bg-rose-500/10 border-2 border-rose-500 shadow-[3px_3px_0px_var(--shadow-color)] flex items-start gap-3 animate-fade-in">
			<div class="flex h-7 w-7 shrink-0 items-center justify-center bg-rose-600 text-white font-mono text-sm font-black">
				✕
			</div>
			<div class="space-y-1 text-xs">
				<p class="font-sans font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
					Cannot Enqueue Assessment
				</p>
				<p class="text-text-primary leading-relaxed font-mono text-[11px]">
					{formError}
				</p>
			</div>
		</div>
	{/if}

	<!-- 7. Actions -->
	<div class="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t-2 border-border-color/20 mt-2">
		{#if isModal}
			<div class="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2 sm:gap-2.5 w-full">
				<button
					type="button"
					onclick={oncancel}
					class="neo-btn text-xs h-9 px-3 sm:px-4 text-center truncate"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={batchItems.length === 0 || !app.network.isOnline}
					class="neo-btn neo-btn-primary text-xs h-9 px-3 sm:px-5 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 font-bold text-center truncate"
					title={!app.network.isOnline ? 'Cannot generate tests while offline' : ''}
				>
					<span>
						{batchItems.length > 1
							? `Enqueue ${batchItems.length} Papers →`
							: 'Enqueue & Generate →'}
					</span>
				</button>
			</div>
		{:else}
			<div class="flex items-center justify-end w-full">
				<button
					type="submit"
					disabled={batchItems.length === 0 || !app.network.isOnline}
					class="neo-btn neo-btn-primary text-sm py-3 px-6 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 font-bold"
					title={!app.network.isOnline ? 'Cannot generate tests while offline' : ''}
				>
					<span>
						{batchItems.length > 1
							? `Enqueue ${batchItems.length} Papers →`
							: 'Enqueue & Generate →'}
					</span>
				</button>
			</div>
		{/if}
	</div>
</form>
