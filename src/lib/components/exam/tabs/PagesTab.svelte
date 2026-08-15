<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { ExtractedPdfPage } from '$lib/types/pdf';
import { copyToClipboard, downloadImage, formatBytes } from '$lib/utils';

const {
	pages = [],
	testFileName = 'document.pdf',
	onzoom,
}: {
	pages: ExtractedPdfPage[];
	testFileName?: string;
	onzoom: (item: { title: string; src: string; info?: string }) => void;
} = $props();

const app = getAppContext();
let copiedId = $state<string | null>(null);

async function handleCopy(url: string, id: string) {
	const ok = await copyToClipboard(url);
	if (ok) {
		copiedId = id;
		app.toast.show('Base64 raster page copied to clipboard!', 'success');
		setTimeout(() => {
			if (copiedId === id) copiedId = null;
		}, 2500);
	}
}

function handleDownload(url: string, filename: string) {
	downloadImage(url, filename);
	app.toast.show(`Downloading "${filename}"...`, 'info');
}
</script>

<div class="space-y-4">
	{#if pages.length === 0}
		<div class="neo-box p-8 text-center bg-surface">
			<p class="font-mono text-xs text-text-muted uppercase">No rendered PDF pages available.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			{#each pages as page (page.pageNumber)}
				<div class="neo-box p-4 bg-surface space-y-3">
					<!-- Page Header Bar -->
					<div class="flex items-center justify-between font-mono text-xs border-b border-border-color/30 pb-2">
						<div class="flex items-center gap-2">
							<span class="neo-badge bg-accent-contrast text-accent-contrast-text font-bold">
								Page {page.pageNumber} / {pages.length}
							</span>
							<span class="text-text-muted text-[10px]">
								{page.rasterWidth}&times;{page.rasterHeight} px
							</span>
						</div>
						<span class="text-text-muted text-[10px]">
							{formatBytes(page.rasterSizeBytes)}
						</span>
					</div>

					<!-- Page View -->
					<div class="border-2 border-border-color bg-muted/20 p-2 flex items-center justify-center max-h-[480px] overflow-hidden group relative">
						<button
							type="button"
							onclick={() =>
								onzoom({
									title: `Rendered Page ${page.pageNumber} of ${pages.length}`,
									src: page.rasterDataUrl,
									info: `${page.rasterWidth} × ${page.rasterHeight} px • ${formatBytes(page.rasterSizeBytes)} • ${page.embeddedImages.length} diagrams isolated`,
								})}
							class="cursor-zoom-in block w-full text-center"
						>
							<img
								src={page.rasterDataUrl}
								alt="PDF Page {page.pageNumber}"
								class="max-h-[460px] w-auto mx-auto object-contain shadow-sm transition-transform group-hover:scale-[1.01]"
								loading="lazy"
							/>
						</button>
						<span class="absolute bottom-3 right-3 bg-surface/90 text-text-primary text-[10px] font-mono font-bold px-2 py-1 border border-border-color opacity-0 group-hover:opacity-100 transition-opacity">
							Click to Enlarge
						</span>
					</div>

					<!-- Action Footer -->
					<div class="flex items-center justify-between gap-2 pt-1 font-mono text-xs">
						<span class="text-[11px] text-text-secondary">
							🎨 {page.embeddedImages.length} {page.embeddedImages.length === 1 ? 'Figure' : 'Figures'}
						</span>
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => handleCopy(page.rasterDataUrl, `page_${page.pageNumber}`)}
								class="neo-btn text-[10px] py-1 px-2.5"
							>
								{copiedId === `page_${page.pageNumber}` ? '✓ Copied' : 'Copy Base64'}
							</button>
							<button
								type="button"
								onclick={() => handleDownload(page.rasterDataUrl, `${testFileName}_page_${page.pageNumber}.png`)}
								class="neo-btn text-[10px] py-1 px-2.5"
							>
								Download PNG
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
