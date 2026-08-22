<script lang="ts">
import ImageLightboxModal from '$lib/components/common/ImageLightboxModal.svelte';
import ExtractionMetricsBar from '$lib/components/pdf/ExtractionMetricsBar.svelte';
import PageExtractionCard from '$lib/components/pdf/PageExtractionCard.svelte';
import {
	extractPdfPagesAndImages,
	generateSamplePdfWithImages,
	type PdfExtractionProgress,
	type PdfExtractionResult,
} from '$lib/services/pdf';
import { copyToClipboard, downloadImage } from '$lib/utils';

// State variables using Svelte 5 runes
let isProcessing = $state(false);
let progressStatus = $state<PdfExtractionProgress>({
	currentPage: 0,
	totalPages: 0,
	statusText: '',
});
let extractionResult = $state<PdfExtractionResult | null>(null);
let errorMessage = $state<string | null>(null);
let isDragging = $state(false);
let selectedScale = $state(1.25);
let copiedId = $state<string | null>(null);
let previewModalImage = $state<{
	title: string;
	src: string;
	width?: number;
	height?: number;
	sizeBytes?: number;
	info?: string;
} | null>(null);

let fileInputElement: HTMLInputElement | null = null;

const scaleOptions = [
	{ label: '1.0x (72 DPI - Fast & Light)', value: 1.0 },
	{ label: '1.25x (90 DPI - Recommended for AI)', value: 1.25 },
	{ label: '1.5x (108 DPI - Crisp Text)', value: 1.5 },
	{ label: '2.0x (144 DPI - High Res)', value: 2.0 },
];

async function handleFileSelect(file: File) {
	if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
		errorMessage = 'Please select a valid PDF document (.pdf).';
		return;
	}

	errorMessage = null;
	isProcessing = true;
	progressStatus = {
		currentPage: 0,
		totalPages: 0,
		statusText: 'Initializing MuPDF WebAssembly Engine...',
	};

	try {
		const result = await extractPdfPagesAndImages(file, {
			scale: selectedScale,
			onProgress: (prog) => {
				progressStatus = prog;
			},
		});
		extractionResult = result;
	} catch (err: unknown) {
		console.error('Extraction error:', err);
		errorMessage =
			err instanceof Error
				? err.message
				: 'Failed to process PDF. Please check the file format and try again.';
	} finally {
		isProcessing = false;
	}
}

async function handleLoadSamplePdf() {
	errorMessage = null;
	isProcessing = true;
	progressStatus = {
		currentPage: 0,
		totalPages: 0,
		statusText: 'Generating in-memory assessment PDF with diagrams...',
	};

	try {
		const sampleBytes = generateSamplePdfWithImages();
		const result = await extractPdfPagesAndImages(sampleBytes, {
			scale: selectedScale,
			onProgress: (prog) => {
				progressStatus = prog;
			},
		});
		result.fileName = 'Sample_Physics_Exam_with_Diagrams.pdf';
		result.fileSizeBytes = sampleBytes.byteLength;
		extractionResult = result;
	} catch (err: unknown) {
		console.error('Sample extraction error:', err);
		errorMessage = err instanceof Error ? err.message : 'Failed to generate and parse sample PDF.';
	} finally {
		isProcessing = false;
	}
}

function handleFileInputChange(e: Event) {
	const target = e.target as HTMLInputElement;
	if (target.files && target.files.length > 0) {
		handleFileSelect(target.files[0]);
	}
}

async function handleCopy(text: string, id: string) {
	const success = await copyToClipboard(text);
	if (success) {
		copiedId = id;
		setTimeout(() => {
			if (copiedId === id) copiedId = null;
		}, 2000);
	}
}
</script>

<svelte:head>
	<title>MuPDF PDF Extraction & Diagram Tester (/pdftest)</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
	<!-- Page Header -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-border-color pb-5 mb-8">
		<div>
			<div class="flex items-center gap-2 mb-1.5">
				<a href="/" class="neo-badge text-xs hover:bg-muted transition-colors inline-flex items-center gap-1">
					&larr; Back to Dashboard
				</a>
				<span class="neo-badge bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs">
					DEV / TESTING TOOL
				</span>
				<span class="neo-badge bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
					MuPDF WASM
				</span>
			</div>
			<h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-text-primary">
				PDF Page, Image & Vector Diagram Extractor
			</h1>
			<p class="text-xs sm:text-sm text-text-secondary mt-1 max-w-3xl">
				Converts each PDF page into a raster PNG image and extracts all embedded bitmap images and vector-drawn physics diagrams.
			</p>
		</div>

		<!-- Action presets & Settings -->
		<div class="flex flex-wrap items-center gap-3">
			<div class="flex items-center gap-1.5">
				<label for="scale-select" class="text-xs font-mono font-bold uppercase text-text-muted">
					Scale:
				</label>
				<select
					id="scale-select"
					bind:value={selectedScale}
					disabled={isProcessing}
					class="neo-input text-xs py-1.5 px-2 bg-surface"
				>
					{#each scaleOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>

			<button
				type="button"
				onclick={handleLoadSamplePdf}
				disabled={isProcessing}
				class="neo-btn text-xs py-2 px-3 bg-accent-contrast text-accent-contrast-text font-bold"
				title="Load pre-built test PDF with multi-page questions & embedded graphics"
			>
				⚡ Load Sample PDF
			</button>
		</div>
	</div>

	<!-- Error Alert -->
	{#if errorMessage}
		<div class="neo-box p-4 mb-6 bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 text-sm flex items-start justify-between gap-3">
			<div class="flex items-center gap-2">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="8" x2="12" y2="12" />
					<line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
				<span>{errorMessage}</span>
			</div>
			<button type="button" onclick={() => (errorMessage = null)} class="text-xs font-bold underline">
				Dismiss
			</button>
		</div>
	{/if}

	<!-- Upload / Drop Area -->
	<section
		class="neo-box p-8 text-center bg-surface transition-all mb-8 relative {isDragging ? 'ring-2 ring-accent-contrast/40 bg-muted/20' : ''}"
		ondragover={(e) => { e.preventDefault(); isDragging = true; }}
		ondragleave={() => (isDragging = false)}
		ondrop={(e) => {
			e.preventDefault();
			isDragging = false;
			if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
				handleFileSelect(e.dataTransfer.files[0]);
			}
		}}
		aria-label="Upload PDF Area"
	>
		<input
			type="file"
			accept=".pdf,application/pdf"
			bind:this={fileInputElement}
			onchange={handleFileInputChange}
			class="hidden"
			id="pdf-upload-input"
		/>

		{#if isProcessing}
			<div class="max-w-md mx-auto py-6 space-y-4">
				<div class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-contrast/10 border-2 border-accent-contrast animate-spin">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-accent-contrast" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<path d="M21 12a9 9 0 1 1-6.219-8.56" />
					</svg>
				</div>
				<div>
					<h3 class="font-mono text-base font-bold uppercase text-text-primary">
						Processing PDF with MuPDF...
					</h3>
					<p class="text-xs text-text-muted mt-1 font-mono">
						{progressStatus.statusText || 'Executing WebAssembly raster & diagram extraction...'}
					</p>
				</div>

				{#if progressStatus.totalPages > 0}
					<div class="w-full bg-muted border border-border-color h-3 rounded-none overflow-hidden">
						<div
							class="bg-accent-contrast h-full transition-all duration-300"
							style="width: {(progressStatus.currentPage / progressStatus.totalPages) * 100}%"
						></div>
					</div>
					<div class="flex justify-between text-[11px] font-mono text-text-muted">
						<span>Page {progressStatus.currentPage} of {progressStatus.totalPages}</span>
						<span>{Math.round((progressStatus.currentPage / progressStatus.totalPages) * 100)}%</span>
					</div>
				{/if}
			</div>
		{:else}
			<div class="max-w-md mx-auto space-y-4">
				<div class="mx-auto flex h-14 w-14 items-center justify-center border-2 border-border-color bg-muted shadow-[2px_2px_0px_var(--shadow-color)]">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" class="h-7 w-7 text-text-primary">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
						<polyline points="14 2 14 8 20 8" />
						<line x1="12" y1="18" x2="12" y2="12" />
						<line x1="9" y1="15" x2="15" y2="15" />
					</svg>
				</div>

				<div>
					<h2 class="font-mono text-lg font-bold uppercase text-text-primary">
						Upload or Drop a PDF Here
					</h2>
					<p class="text-xs text-text-secondary mt-1">
						MuPDF will render each page as a low-overhead raster PNG and extract all embedded graphics and vector diagrams.
					</p>
				</div>

				<div class="flex flex-wrap items-center justify-center gap-3 pt-2">
					<button
						type="button"
						onclick={() => fileInputElement?.click()}
						class="neo-btn neo-btn-primary text-xs py-2 px-5"
					>
						Browse PDF File
					</button>
					<span class="text-xs text-text-muted uppercase font-mono">or</span>
					<button
						type="button"
						onclick={handleLoadSamplePdf}
						class="neo-btn text-xs py-2 px-4"
					>
						Load Instant Sample
					</button>
				</div>
			</div>
		{/if}
	</section>

	<!-- Results Section -->
	{#if extractionResult}
		<section class="space-y-8 animate-fade-in" aria-label="Extraction Results">
			<!-- Metrics Summary Bar -->
			<ExtractionMetricsBar
				result={extractionResult}
				onuploadanother={() => fileInputElement?.click()}
				onclear={() => {
					extractionResult = null;
					if (fileInputElement) fileInputElement.value = '';
				}}
			/>

			<!-- Page Cards -->
			<div class="space-y-8">
				{#each extractionResult.pages as page (page.pageNumber)}
					<PageExtractionCard
						{page}
						totalPages={extractionResult.totalPages}
						fileName={extractionResult.fileName}
						{copiedId}
						oncopy={handleCopy}
						ondownload={downloadImage}
						onzoom={(item) => (previewModalImage = item)}
					/>
				{/each}
			</div>
		</section>
	{/if}
</div>

<!-- Shared Lightbox Modal -->
<ImageLightboxModal
	image={previewModalImage}
	onclose={() => (previewModalImage = null)}
/>
