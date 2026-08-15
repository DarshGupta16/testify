<script lang="ts">
import type { ExtractedPdfPage } from '$lib/services/pdf/types';
import { formatBytes } from '$lib/utils';

const {
	page,
	totalPages,
	fileName,
	copiedId,
	oncopy,
	ondownload,
	onzoom,
}: {
	page: ExtractedPdfPage;
	totalPages: number;
	fileName: string;
	copiedId: string | null;
	oncopy: (text: string, id: string) => void;
	ondownload: (url: string, filename: string) => void;
	onzoom: (item: {
		title: string;
		src: string;
		width?: number;
		height?: number;
		sizeBytes?: number;
		info?: string;
	}) => void;
} = $props();

const safeDocName = $derived(fileName.replace(/\.pdf$/i, ''));
</script>

<div class="neo-box p-5 bg-surface border-2 border-border-color space-y-4">
	<!-- Page Header -->
	<div class="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border-color pb-3">
		<div class="flex items-center gap-3">
			<span class="neo-badge bg-accent-contrast text-accent-contrast-text text-xs font-black">
				PAGE {page.pageNumber} / {totalPages}
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
		<!-- Left Column: Full Page Raster PNG -->
		<div class="lg:col-span-6 space-y-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<span class="font-mono text-xs font-bold uppercase text-text-primary">
						📄 Rendered Raster Page (PNG)
					</span>
					<span class="font-mono text-[11px] text-text-muted">
						({page.rasterWidth}&times;{page.rasterHeight} px &bull; {formatBytes(page.rasterSizeBytes)})
					</span>
				</div>

				<div class="flex items-center gap-1.5">
					<button
						type="button"
						onclick={() => oncopy(page.rasterDataUrl, `page_${page.pageNumber}`)}
						class="neo-btn text-[11px] py-1 px-2.5"
						title="Copy base64 data URL to send to AI"
					>
						{copiedId === `page_${page.pageNumber}` ? '✓ Copied!' : 'Copy Base64'}
					</button>
					<button
						type="button"
						onclick={() => ondownload(page.rasterDataUrl, `${safeDocName}_page_${page.pageNumber}.png`)}
						class="neo-btn text-[11px] py-1 px-2.5"
						title="Download full page PNG"
					>
						Download PNG
					</button>
				</div>
			</div>

			<!-- Page Image Thumbnail -->
			<div class="border-2 border-border-color bg-muted/20 p-2 relative group flex items-center justify-center max-h-[640px] overflow-hidden">
				<button
					type="button"
					onclick={() => onzoom({
						title: `Page ${page.pageNumber} - Raster View`,
						src: page.rasterDataUrl,
						width: page.rasterWidth,
						height: page.rasterHeight,
						sizeBytes: page.rasterSizeBytes,
					})}
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

		<!-- Right Column: Extracted Diagrams & Images -->
		<div class="lg:col-span-6 space-y-3">
			<div class="flex items-center justify-between">
				<span class="font-mono text-xs font-bold uppercase text-text-primary">
					🖼️ Extracted Diagrams & Images ({page.embeddedImages.length})
				</span>
			</div>

			{#if page.embeddedImages.length === 0}
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
				<div class="space-y-4 max-h-[640px] overflow-y-auto pr-1">
					{#each page.embeddedImages as img, idx (img.id)}
						<div class="border-2 border-border-color bg-surface p-3.5 space-y-3">
							<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border-color/40 pb-2">
								<div class="flex items-center gap-2">
									<span class="neo-badge bg-accent-contrast/15 text-accent-contrast text-[11px] font-mono font-bold">
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
									{img.width} &times; {img.height} px &bull; {formatBytes(img.sizeBytes)}
								</span>
							</div>

							<!-- Image Thumbnail -->
							<div class="border border-border-color bg-muted/30 p-2 flex items-center justify-center min-h-[120px] max-h-[220px] overflow-hidden group relative">
								<button
									type="button"
									onclick={() => onzoom({
										title: `Page ${page.pageNumber} - ${img.type === 'vector_diagram' ? 'Vector Diagram' : 'Raster Image'} #${idx + 1}`,
										src: img.dataUrl,
										width: img.width,
										height: img.height,
										sizeBytes: img.sizeBytes,
									})}
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

							<!-- Actions -->
							<div class="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-border-color/30">
								<button
									type="button"
									onclick={() => oncopy(img.dataUrl, img.id)}
									class="neo-btn text-[10px] py-1 px-2.5"
									title="Copy base64 image data"
								>
									{copiedId === img.id ? '✓ Copied Base64' : 'Copy Base64'}
								</button>
								<button
									type="button"
									onclick={() => ondownload(img.dataUrl, `${safeDocName}_p${page.pageNumber}_item${idx + 1}.png`)}
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
