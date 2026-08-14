<script lang="ts">
import {
	type ExtractedEmbeddedImage,
	type ExtractedPdfPage,
	extractPdfPagesAndImages,
	generateSamplePdfWithImages,
	type PdfExtractionResult,
} from '$lib/services/pdfExtractor';

// State variables using Svelte 5 runes
let isProcessing = $state(false);
let progressStatus = $state<{
	currentPage: number;
	totalPages: number;
	statusText: string;
}>({
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
	url: string;
	width: number;
	height: number;
	size: number;
} | null>(null);

let fileInputElement: HTMLInputElement | null = null;

// Scale preset options
const scaleOptions = [
	{ label: '1.0x (72 DPI - Fast & Light)', value: 1.0 },
	{ label: '1.25x (90 DPI - Recommended for AI)', value: 1.25 },
	{ label: '1.5x (108 DPI - Crisp Text)', value: 1.5 },
	{ label: '2.0x (144 DPI - High Res)', value: 2.0 },
];

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}

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
		statusText: 'Generating sample multi-page PDF with embedded diagrams and questions...',
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

function handleDragOver(e: DragEvent) {
	e.preventDefault();
	isDragging = true;
}

function handleDragLeave() {
	isDragging = false;
}

function handleDrop(e: DragEvent) {
	e.preventDefault();
	isDragging = false;
	if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
		handleFileSelect(e.dataTransfer.files[0]);
	}
}

async function copyToClipboard(text: string, id: string) {
	try {
		await navigator.clipboard.writeText(text);
		copiedId = id;
		setTimeout(() => {
			if (copiedId === id) copiedId = null;
		}, 2000);
	} catch {
		const textarea = document.createElement('textarea');
		textarea.value = text;
		document.body.appendChild(textarea);
		textarea.select();
		document.execCommand('copy');
		document.body.removeChild(textarea);
		copiedId = id;
		setTimeout(() => {
			if (copiedId === id) copiedId = null;
		}, 2000);
	}
}

function downloadImage(url: string, filename: string) {
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}

function openLightbox(title: string, url: string, width: number, height: number, size: number) {
	previewModalImage = { title, url, width, height, size };
}

function closeLightbox() {
	previewModalImage = null;
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
				class="neo-btn text-xs py-2 px-3 bg-accent/10 hover:bg-accent/20 text-accent font-bold"
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
		class="neo-box p-8 text-center bg-surface transition-all mb-8 relative {isDragging ? 'border-accent ring-2 ring-accent/30 bg-accent/5' : ''}"
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
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
			<!-- Processing State with Progress Bar -->
			<div class="max-w-md mx-auto py-6 space-y-4">
				<div class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 border-2 border-accent animate-spin">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
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
							class="bg-accent h-full transition-all duration-300"
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
			<!-- Idle / Upload Call to Action -->
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
			<div class="neo-box p-5 bg-surface">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-color/40 pb-4 mb-4">
					<div>
						<div class="flex items-center gap-2">
							<span class="font-mono text-xs font-bold text-accent uppercase">
								Extraction Complete
							</span>
							<span class="text-xs text-text-muted">•</span>
							<span class="text-xs font-mono text-text-secondary">
								Scale factor: {extractionResult.scale}x
							</span>
						</div>
						<h2 class="text-lg sm:text-xl font-black uppercase text-text-primary truncate max-w-xl">
							{extractionResult.fileName}
						</h2>
					</div>

					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={() => fileInputElement?.click()}
							class="neo-btn text-xs py-1.5 px-3"
						>
							Upload Another PDF
						</button>
						<button
							type="button"
							onclick={() => {
								extractionResult = null;
								if (fileInputElement) fileInputElement.value = '';
							}}
							class="neo-btn text-xs py-1.5 px-3 text-rose-500 hover:bg-rose-600 hover:text-white"
						>
							Clear
						</button>
					</div>
				</div>

				<!-- Stats Grid -->
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
					<div class="border-2 border-border-color bg-muted/40 p-3">
						<div class="font-mono text-[10px] uppercase text-text-muted font-bold">Total Pages</div>
						<div class="font-mono text-xl font-black text-text-primary mt-0.5">
							{extractionResult.totalPages}
						</div>
					</div>

					<div class="border-2 border-border-color bg-muted/40 p-3">
						<div class="font-mono text-[10px] uppercase text-text-muted font-bold">Diagrams / Images</div>
						<div class="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
							{extractionResult.totalEmbeddedImages}
						</div>
					</div>

					<div class="border-2 border-border-color bg-muted/40 p-3">
						<div class="font-mono text-[10px] uppercase text-text-muted font-bold">File Size</div>
						<div class="font-mono text-xl font-black text-text-primary mt-0.5">
							{formatBytes(extractionResult.fileSizeBytes)}
						</div>
					</div>

					<div class="border-2 border-border-color bg-muted/40 p-3">
						<div class="font-mono text-[10px] uppercase text-text-muted font-bold">Extraction Time</div>
						<div class="font-mono text-xl font-black text-accent mt-0.5">
							{extractionResult.durationMs} ms
						</div>
					</div>
				</div>
			</div>

			<!-- Page-by-Page Side-by-Side Comparison -->
			<div class="space-y-8">
				{#each extractionResult.pages as page (page.pageNumber)}
					<div class="neo-box p-5 bg-surface border-2 border-border-color space-y-4">
						<!-- Page Header -->
						<div class="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border-color pb-3">
							<div class="flex items-center gap-3">
								<span class="neo-badge bg-accent text-accent-contrast-text text-xs font-black">
									PAGE {page.pageNumber} / {extractionResult.totalPages}
								</span>
								<span class="font-mono text-xs text-text-muted">
									Doc bounds: {page.pageWidth} &times; {page.pageHeight} pt
								</span>
							</div>

							<div class="flex items-center gap-2">
								<span class="neo-badge text-xs {page.embeddedImages.length > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'text-text-muted'}">
									{page.embeddedImages.length} {page.embeddedImages.length === 1 ? 'Extracted Diagram/Image' : 'Extracted Diagrams/Images'}
								</span>
							</div>
						</div>

						<!-- Two Column Layout: Full Raster Page vs Extracted Diagrams -->
						<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
							<!-- Left Column (lg:col-span-6): Full Page Raster Image -->
							<div class="lg:col-span-6 space-y-3">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span class="font-mono text-xs font-bold uppercase text-text-primary">
											📄 Rendered Raster Page (PNG)
										</span>
										<span class="font-mono text-[11px] text-text-muted">
											({page.rasterWidth}&times;{page.rasterHeight} px • {formatBytes(page.rasterSizeBytes)})
										</span>
									</div>

									<div class="flex items-center gap-1.5">
										<button
											type="button"
											onclick={() => copyToClipboard(page.rasterDataUrl, `page_${page.pageNumber}`)}
											class="neo-btn text-[11px] py-1 px-2.5"
											title="Copy base64 data URL to send to AI"
										>
											{copiedId === `page_${page.pageNumber}` ? '✓ Copied!' : 'Copy Base64'}
										</button>
										<button
											type="button"
											onclick={() => downloadImage(page.rasterDataUrl, `${extractionResult?.fileName.replace(/\.pdf$/i, '')}_page_${page.pageNumber}.png`)}
											class="neo-btn text-[11px] py-1 px-2.5"
											title="Download full page PNG"
										>
											Download PNG
										</button>
									</div>
								</div>

								<!-- Page Image Container -->
								<div class="border-2 border-border-color bg-muted/20 p-2 relative group flex items-center justify-center max-h-[640px] overflow-hidden">
									<button
										type="button"
										onclick={() => openLightbox(`Page ${page.pageNumber} - Raster View`, page.rasterDataUrl, page.rasterWidth, page.rasterHeight, page.rasterSizeBytes)}
										class="cursor-zoom-in block w-full text-center"
										title="Click to view full size"
									>
										<img
											src={page.rasterDataUrl}
											alt="Rendered PDF Page {page.pageNumber}"
											class="max-h-[620px] w-auto mx-auto object-contain shadow-sm transition-transform group-hover:scale-[1.01]"
											loading="lazy"
										/>
									</button>
									<span class="absolute bottom-3 right-3 bg-surface/90 text-text-primary text-[10px] font-mono font-bold px-2 py-1 border border-border-color opacity-0 group-hover:opacity-100 transition-opacity">
										Click to Zoom
									</span>
								</div>
							</div>

							<!-- Right Column (lg:col-span-6): Extracted Diagrams & Images -->
							<div class="lg:col-span-6 space-y-3">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span class="font-mono text-xs font-bold uppercase text-text-primary">
											🖼️ Extracted Diagrams & Images ({page.embeddedImages.length})
										</span>
									</div>
								</div>

								{#if page.embeddedImages.length === 0}
									<!-- No Embedded Images Found on this Page -->
									<div class="border-2 border-dashed border-border-color bg-muted/30 p-8 text-center space-y-2 h-[260px] flex flex-col items-center justify-center">
										<div class="text-3xl">🔍</div>
										<h4 class="font-mono text-xs font-bold uppercase text-text-primary">
											No Diagrams or Images on Page {page.pageNumber}
										</h4>
										<p class="text-[11px] text-text-muted max-w-xs">
											This page contains text and math formulas only. No discrete raster images or vector diagrams were encountered.
										</p>
									</div>
								{:else}
									<!-- Embedded Images & Vector Diagrams List -->
									<div class="space-y-4 max-h-[640px] overflow-y-auto pr-1">
										{#each page.embeddedImages as img, idx (img.id)}
											<div class="border-2 border-border-color bg-surface p-3.5 space-y-3">
												<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border-color/40 pb-2">
													<div class="flex items-center gap-2">
														<span class="neo-badge bg-accent/15 text-accent text-[11px] font-mono font-bold">
															Item #{idx + 1}
														</span>
														{#if img.type === 'vector_diagram'}
															<span class="neo-badge bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] font-mono font-bold">
																VECTOR DIAGRAM
															</span>
														{:else}
															<span class="neo-badge bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-mono font-bold">
																RASTER IMAGE
															</span>
														{/if}
														{#if img.position}
															<span class="text-[10px] font-mono text-text-muted">
																({img.position.x}, {img.position.y} pt)
															</span>
														{/if}
													</div>

													<span class="font-mono text-[11px] text-text-secondary font-bold">
														{img.width} &times; {img.height} px • {formatBytes(img.sizeBytes)}
													</span>
												</div>

												<!-- Image Thumbnail Preview -->
												<div class="border border-border-color bg-muted/30 p-2 flex items-center justify-center min-h-[120px] max-h-[220px] overflow-hidden group relative">
													<button
														type="button"
														onclick={() => openLightbox(`Page ${page.pageNumber} - ${img.type === 'vector_diagram' ? 'Vector Diagram' : 'Raster Image'} #${idx + 1}`, img.dataUrl, img.width, img.height, img.sizeBytes)}
														class="cursor-zoom-in block w-full text-center"
														title="Click to view full size"
													>
														<img
															src={img.dataUrl}
															alt="{img.type === 'vector_diagram' ? 'Vector Diagram' : 'Raster Image'} #{idx + 1} from Page {page.pageNumber}"
															class="max-h-[200px] max-w-full mx-auto object-contain transition-transform group-hover:scale-105"
															loading="lazy"
														/>
													</button>
													<span class="absolute bottom-2 right-2 bg-surface/90 text-text-primary text-[9px] font-mono font-bold px-1.5 py-0.5 border border-border-color opacity-0 group-hover:opacity-100 transition-opacity">
														Click to Zoom
													</span>
												</div>

												<!-- Action Buttons -->
												<div class="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-border-color/30">
													<button
														type="button"
														onclick={() => copyToClipboard(img.dataUrl, img.id)}
														class="neo-btn text-[10px] py-1 px-2.5"
														title="Copy base64 image data"
													>
														{copiedId === img.id ? '✓ Copied Base64' : 'Copy Base64'}
													</button>
													<button
														type="button"
														onclick={() => downloadImage(img.dataUrl, `${extractionResult?.fileName.replace(/\.pdf$/i, '')}_p${page.pageNumber}_item${idx + 1}.png`)}
														class="neo-btn text-[10px] py-1 px-2.5"
														title="Download extracted image PNG"
													>
														Download PNG
													</button>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>

<!-- Full Size Image Lightbox Modal -->
{#if previewModalImage}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
		role="dialog"
		aria-modal="true"
		aria-label={previewModalImage.title}
	>
		<!-- Backdrop button to dismiss modal -->
		<button
			type="button"
			class="absolute inset-0 h-full w-full cursor-default bg-transparent border-none"
			onclick={closeLightbox}
			aria-label="Close preview"
		></button>

		<div
			class="neo-box relative z-10 bg-surface p-4 max-w-5xl w-full max-h-[90vh] flex flex-col space-y-3"
			role="document"
		>
			<div class="flex items-center justify-between border-b border-border-color pb-2">
				<div class="flex items-center gap-2">
					<span class="font-mono text-xs font-bold uppercase text-text-primary truncate">
						{previewModalImage.title}
					</span>
					<span class="font-mono text-[11px] text-text-muted">
						({previewModalImage.width} &times; {previewModalImage.height} px • {formatBytes(previewModalImage.size)})
					</span>
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => downloadImage(previewModalImage!.url, `${previewModalImage!.title.toLowerCase().replace(/\s+/g, '_')}.png`)}
						class="neo-btn text-xs py-1 px-2.5"
					>
						Download
					</button>
					<button
						type="button"
						onclick={closeLightbox}
						class="neo-btn text-xs py-1 px-2.5"
					>
						Close &times;
					</button>
				</div>
			</div>

			<div class="flex-1 overflow-auto flex items-center justify-center p-2 bg-muted/20 border border-border-color min-h-[300px]">
				<img
					src={previewModalImage.url}
					alt={previewModalImage.title}
					class="max-h-[60vh] max-w-full object-contain mx-auto"
				/>
			</div>
		</div>
	</div>
{/if}
