<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { TestUploadPayload } from '$lib/types/test';

const app = getAppContext();

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

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

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
	title = 'Physics Mechanics & Newton Laws';
	subject = 'STEM';
	durationMinutes = 90;
	questionCount = 30;
	app.selectedScale = 1.25;
}

async function handleSubmit(e: SubmitEvent) {
	e.preventDefault();

	const payload: TestUploadPayload = {
		title: title.trim() || testFile?.name.replace(/\.[^/.]+$/, '') || 'Custom Test',
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

	await app.handleAddTest(payload);

	// Reset inputs
	title = '';
	testFile = null;
	testFileObj = null;
	answerKeyFile = null;
	answerKeyFileObj = null;
}

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === 'Escape' && !app.tests.isUploading) {
		app.modals.closeUpload();
	}
}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if app.modals.isUploadModalOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fade-in"
		onclick={(e) => {
			if (e.target === e.currentTarget && !app.tests.isUploading) {
				app.modals.closeUpload();
			}
		}}
		role="presentation"
	>
		<!-- Modal Content -->
		<div
			class="neo-box-lg w-full max-w-2xl bg-surface p-6 sm:p-8 animate-slide-down max-h-[90vh] overflow-y-auto"
			role="dialog"
			aria-modal="true"
			aria-labelledby="upload-modal-title"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b-2 border-border-color pb-4 mb-6">
				<div class="flex items-center gap-2.5">
					<div class="h-4 w-4 bg-accent-contrast"></div>
					<h2 id="upload-modal-title" class="text-lg sm:text-xl font-extrabold uppercase tracking-wide">
						Upload & Ingest Test PDF
					</h2>
				</div>
				<button
					type="button"
					onclick={() => app.modals.closeUpload()}
					disabled={app.tests.isUploading}
					class="neo-btn text-xs py-1 px-2.5 disabled:opacity-40"
					aria-label="Close modal"
				>
					✕
				</button>
			</div>

			<form onsubmit={handleSubmit} class="space-y-5">
				<!-- Dual File Uploads -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<!-- 1. Question Paper PDF -->
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label for="modal-test-file" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
								1. Test Paper PDF <span class="text-rose-500">*</span>
							</label>
						</div>

						<input
							id="modal-test-file"
							type="file"
							accept=".pdf"
							bind:this={testInputRef}
							onchange={handleTestFileChange}
							class="hidden"
						/>

						{#if testFile}
							<div class="neo-box-sm p-3 flex items-center justify-between bg-muted/40">
								<div class="truncate pr-2">
									<p class="text-xs font-bold truncate text-text-primary">{testFile.name}</p>
									<p class="font-mono text-[10px] text-text-muted">{testFile.formattedSize}</p>
								</div>
								<button
									type="button"
									onclick={clearTestFile}
									disabled={app.tests.isUploading}
									class="neo-btn text-[10px] py-0.5 px-1.5"
								>
									✕
								</button>
							</div>
						{:else}
							<button
								type="button"
								onclick={() => testInputRef?.click()}
								disabled={app.tests.isUploading}
								class="w-full flex flex-col items-center justify-center border-2 border-dashed border-border-color p-4 text-center bg-surface hover:bg-muted/30 transition-colors cursor-pointer disabled:opacity-50"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									class="h-5 w-5 mb-1 text-text-muted"
								>
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
									<polyline points="17 8 12 3 7 8" />
									<line x1="12" y1="3" x2="12" y2="15" />
								</svg>
								<span class="text-xs font-bold uppercase">Select Test PDF</span>
							</button>
						{/if}
					</div>

					<!-- 2. Answer Key PDF -->
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label for="modal-key-file" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
								2. Answer Key PDF
							</label>
							<span class="font-mono text-[10px] uppercase text-text-muted">Optional</span>
						</div>

						<input
							id="modal-key-file"
							type="file"
							accept=".pdf"
							bind:this={answerKeyInputRef}
							onchange={handleAnswerKeyFileChange}
							class="hidden"
						/>

						{#if answerKeyFile}
							<div class="neo-box-sm p-3 flex items-center justify-between bg-muted/40">
								<div class="truncate pr-2">
									<p class="text-xs font-bold truncate text-text-primary">{answerKeyFile.name}</p>
									<p class="font-mono text-[10px] text-text-muted">{answerKeyFile.formattedSize}</p>
								</div>
								<button
									type="button"
									onclick={clearAnswerKeyFile}
									disabled={app.tests.isUploading}
									class="neo-btn text-[10px] py-0.5 px-1.5"
								>
									✕
								</button>
							</div>
						{:else}
							<button
								type="button"
								onclick={() => answerKeyInputRef?.click()}
								disabled={app.tests.isUploading}
								class="w-full flex flex-col items-center justify-center border-2 border-dashed border-border-color p-4 text-center bg-surface hover:bg-muted/30 transition-colors cursor-pointer disabled:opacity-50"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									class="h-5 w-5 mb-1 text-text-muted"
								>
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
									<polyline points="14 2 14 8 20 8" />
								</svg>
								<span class="text-xs font-bold uppercase">Select Answer Key</span>
							</button>
						{/if}
					</div>
				</div>

				<!-- Extraction Engine Configuration Row (Scale Preset Selector) -->
				<div class="p-3.5 bg-muted/30 border-2 border-border-color/60">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
						<div>
							<div class="flex items-center gap-1.5">
								<span class="inline-block h-2 w-2 bg-emerald-500 rounded-full"></span>
								<label for="modal-scale-select" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
									Extraction Resolution Scale
								</label>
							</div>
							<p class="text-[11px] text-text-muted mt-0.5">
								Controls full-page rendering fidelity and vector diagram crop clarity.
							</p>
						</div>

						<select
							id="modal-scale-select"
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

				<!-- Metadata Fields -->
				<div class="space-y-3 pt-2 border-t border-border-color/20">
					<div>
						<label for="modal-title" class="block font-mono text-xs font-bold uppercase tracking-wider mb-1 text-text-primary">
							Assessment Title
						</label>
						<input
							id="modal-title"
							type="text"
							bind:value={title}
							disabled={app.tests.isUploading}
							placeholder="e.g. Physics Dynamics & Kinematics Paper"
							class="neo-input w-full text-sm"
						/>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
						<div>
							<label for="modal-subject" class="block font-mono text-xs font-bold uppercase tracking-wider mb-1 text-text-primary">
								Subject
							</label>
							<select
								id="modal-subject"
								bind:value={subject}
								disabled={app.tests.isUploading}
								class="neo-input w-full text-sm font-sans"
							>
								<option value="STEM">STEM</option>
								<option value="Computer Science">Computer Science</option>
								<option value="Humanities">Humanities</option>
								<option value="Languages">Languages</option>
								<option value="General">General</option>
							</select>
						</div>

						<div>
							<label for="modal-duration" class="block font-mono text-xs font-bold uppercase tracking-wider mb-1 text-text-primary">
								Duration (Mins)
							</label>
							<input
								id="modal-duration"
								type="number"
								min="5"
								max="360"
								bind:value={durationMinutes}
								disabled={app.tests.isUploading}
								class="neo-input w-full text-sm font-mono"
							/>
						</div>

						<div>
							<label for="modal-questions" class="block font-mono text-xs font-bold uppercase tracking-wider mb-1 text-text-primary">
								Questions
							</label>
							<input
								id="modal-questions"
								type="number"
								min="1"
								max="200"
								bind:value={questionCount}
								disabled={app.tests.isUploading}
								class="neo-input w-full text-sm font-mono"
							/>
						</div>
					</div>
				</div>

				<!-- Live MuPDF Progress Indicator -->
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

				<!-- Actions -->
				<div class="flex items-center justify-between gap-3 pt-3 border-t border-border-color/20">
					<button
						type="button"
						onclick={fillDemoFile}
						disabled={app.tests.isUploading}
						class="font-mono text-xs text-text-muted hover:text-text-primary underline cursor-pointer disabled:opacity-40"
					>
						Fill Sample Data
					</button>

					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={() => app.modals.closeUpload()}
							disabled={app.tests.isUploading}
							class="neo-btn text-xs py-2 px-3 disabled:opacity-40"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={app.tests.isUploading}
							class="neo-btn neo-btn-primary text-xs py-2 px-4 disabled:opacity-50 flex items-center gap-1.5"
						>
							{#if app.tests.isUploading}
								<span class="inline-block h-3 w-3 border-2 border-current border-t-transparent animate-spin"></span>
								<span>Ingesting PDF...</span>
							{:else}
								<span>Ingest & Create Test &rarr;</span>
							{/if}
						</button>
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}
