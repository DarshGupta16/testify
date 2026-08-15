<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
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
let title = $state('');
let subject = $state('STEM');
let durationMinutes = $state(60);
let questionCount = $state(25);

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
		if (!title) {
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

function fillDemoFile() {
	testFile = {
		name: 'Physics_Assessment_Sample.pdf',
		size: 2800000,
		formattedSize: '2.7 MB',
	};
	testFileObj = null;
	answerKeyFile = {
		name: 'Physics_Answers_Detailed.pdf',
		size: 950000,
		formattedSize: '928 KB',
	};
	answerKeyFileObj = null;
	title = 'Physics Mechanics & Dynamics';
	subject = 'STEM';
	durationMinutes = 90;
	questionCount = 30;
	app.selectedScale = 1.25;
}

async function handleSubmit(e: SubmitEvent) {
	e.preventDefault();

	if (!testFile && !title) {
		testFile = {
			name: 'Practice_Midterm_Paper.pdf',
			size: 2450000,
			formattedSize: '2.3 MB',
		};
	}

	const payload: TestUploadPayload = {
		title: title.trim() || testFile?.name.replace(/\.[^/.]+$/, '') || 'General Assessment',
		subject,
		durationMinutes: Number(durationMinutes) || 60,
		questionCount: Number(questionCount) || 20,
		scale: Number(app.selectedScale) || 1.25,
		testFile: testFile
			? {
					...testFile,
					rawFile: testFileObj || undefined,
				}
			: null,
		answerKeyFile: answerKeyFile
			? {
					...answerKeyFile,
					rawFile: answerKeyFileObj || undefined,
				}
			: null,
	};

	const createdTest = await app.handleAddTest(payload);

	// Reset form fields
	title = '';
	clearTestFile();
	clearAnswerKeyFile();

	onsuccess?.(createdTest);
}
</script>

<form onsubmit={handleSubmit} class="space-y-5">
	<!-- Top Row: Demo Auto-Fill Action -->
	<div class="flex items-center justify-between pb-1">
		<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">
			PDF Documents
		</span>
		<button
			type="button"
			onclick={fillDemoFile}
			disabled={app.tests.isUploading}
			class="font-mono text-xs text-text-muted hover:text-text-primary underline cursor-pointer disabled:opacity-40"
		>
			Auto-fill Sample Data
		</button>
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
						Enables instant auto-scoring
					</span>
				</button>
			{/if}
		</div>
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

	<!-- Assessment Metadata Fields -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t-2 border-border-color/20">
		<div class="sm:col-span-3">
			<label for="form-title" class="block font-mono text-xs font-bold uppercase tracking-wider mb-1 text-text-primary">
				Assessment Title
			</label>
			<input
				id="form-title"
				type="text"
				bind:value={title}
				disabled={app.tests.isUploading}
				placeholder="e.g. Physics Midterm Examination 2026"
				class="neo-input w-full text-sm"
			/>
		</div>

		<div>
			<label for="form-subject" class="block font-mono text-xs font-bold uppercase tracking-wider mb-1 text-text-primary">
				Subject / Field
			</label>
			<select
				id="form-subject"
				bind:value={subject}
				disabled={app.tests.isUploading}
				class="neo-input w-full text-sm font-sans"
			>
				<option value="STEM">STEM & Sciences</option>
				<option value="Computer Science">Computer Science</option>
				<option value="Humanities">Humanities & Social</option>
				<option value="Languages">Languages & Literature</option>
				<option value="General">General Assessment</option>
			</select>
		</div>

		<div>
			<label for="form-duration" class="block font-mono text-xs font-bold uppercase tracking-wider mb-1 text-text-primary">
				Duration (Mins)
			</label>
			<input
				id="form-duration"
				type="number"
				min="5"
				max="360"
				bind:value={durationMinutes}
				disabled={app.tests.isUploading}
				class="neo-input w-full text-sm font-mono"
			/>
		</div>

		<div>
			<label for="form-questions" class="block font-mono text-xs font-bold uppercase tracking-wider mb-1 text-text-primary">
				Est. Questions
			</label>
			<input
				id="form-questions"
				type="number"
				min="1"
				max="200"
				bind:value={questionCount}
				disabled={app.tests.isUploading}
				class="neo-input w-full text-sm font-mono"
			/>
		</div>
	</div>

	<!-- Live MuPDF Progress Bar -->
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
	<div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border-color/20">
		{#if isModal}
			<div class="flex items-center justify-end gap-2 w-full">
				<button
					type="button"
					onclick={oncancel}
					disabled={app.tests.isUploading}
					class="neo-btn text-xs py-2 px-3.5 disabled:opacity-40"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={app.tests.isUploading}
					class="neo-btn neo-btn-primary text-xs py-2 px-5 disabled:opacity-50 flex items-center gap-1.5"
				>
					{#if app.tests.isUploading}
						<span class="inline-block h-3 w-3 border-2 border-current border-t-transparent animate-spin"></span>
						<span>Ingesting PDF...</span>
					{:else}
						<span>Ingest & Create Test &rarr;</span>
					{/if}
				</button>
			</div>
		{:else}
			<button
				type="button"
				onclick={() => app.handleLoadSamples()}
				disabled={app.tests.isUploading}
				class="neo-btn text-xs w-full sm:w-auto disabled:opacity-40"
			>
				&rarr; Or Populate Demo Tests
			</button>

			<button
				type="submit"
				disabled={app.tests.isUploading}
				class="neo-btn neo-btn-primary text-sm py-3 px-6 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
			>
				{#if app.tests.isUploading}
					<span class="inline-block h-3 w-3 border-2 border-current border-t-transparent animate-spin"></span>
					<span>Ingesting PDF...</span>
				{:else}
					<span>Generate Test &rarr;</span>
				{/if}
			</button>
		{/if}
	</div>
</form>
