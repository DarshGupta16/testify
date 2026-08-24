<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { ExtractedEmbeddedImage } from '$lib/types/pdf';
import { copyToClipboard, downloadImage, formatBytes } from '$lib/utils';

const {
	diagrams = [],
	testTitle = 'Assessment',
	onzoom,
}: {
	diagrams: ExtractedEmbeddedImage[];
	testTitle?: string;
	onzoom: (item: { title: string; src: string; info?: string }) => void;
} = $props();

const app = getAppContext();
let copiedId = $state<string | null>(null);

async function handleCopy(url: string, id: string) {
	const ok = await copyToClipboard(url);
	if (ok) {
		copiedId = id;
		app.toast.show('Base64 image data copied to clipboard!', 'success');
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
	{#if diagrams.length === 0}
		<div class="neo-box p-8 text-center bg-surface">
			<p class="font-mono text-xs text-text-muted uppercase">No discrete diagrams or figures isolated from this PDF.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each diagrams as diag, idx (diag.id)}
				<div class="neo-box diagram-item-container p-3.5 bg-surface flex flex-col justify-between space-y-3">
					<div>
						<!-- Badge header -->
						<div class="flex items-center justify-between font-mono text-[11px] border-b border-border-color/30 pb-2 mb-2">
							<span class="neo-badge bg-accent-contrast/15 text-accent-contrast font-bold">
								Figure #{idx + 1}
							</span>
							<span class="text-text-muted">
								Page {diag.pageNumber}
							</span>
						</div>

						<!-- Diagram image -->
						<div class="border border-border-color bg-white p-2 flex items-center justify-center min-h-[140px] max-h-[220px] overflow-hidden group relative">
							<button
								type="button"
								onclick={() =>
									onzoom({
										title: `Figure #${idx + 1} (Page ${diag.pageNumber})`,
										src: diag.dataUrl,
										info: `${diag.width} × ${diag.height} px • ${formatBytes(diag.sizeBytes)} • ${diag.type === 'vector_diagram' ? 'Vector Diagram' : 'Raster Image'}`,
									})}
								class="cursor-zoom-in block w-full text-center"
							>
								<img
									src={diag.dataUrl}
									alt="Diagram {idx + 1}"
									class="max-h-[190px] max-w-full mx-auto object-contain transition-transform group-hover:scale-105"
									loading="lazy"
								/>
							</button>
							<span class="absolute bottom-2 right-2 bg-surface/90 text-text-primary text-[9px] font-mono font-bold px-1.5 py-0.5 border border-border-color opacity-0 group-hover:opacity-100 transition-opacity">
								Zoom
							</span>
						</div>

						<p class="font-mono text-[10px] text-text-muted mt-2 truncate" title={diag.id}>
							ID: {diag.id} ({diag.width} &times; {diag.height} px)
						</p>
					</div>

					<!-- Action Buttons -->
					<div class="flex items-center justify-between gap-1.5 pt-2 border-t border-border-color/30 font-mono text-[10px]">
						<button
							type="button"
							onclick={() => handleCopy(diag.dataUrl, diag.id)}
							class="neo-btn py-1 px-2 flex-1 text-center"
						>
							{copiedId === diag.id ? '✓ Copied' : 'Copy Data'}
						</button>
						<button
							type="button"
							onclick={() => handleDownload(diag.dataUrl, `${testTitle}_fig_${idx + 1}.png`)}
							class="neo-btn py-1 px-2 flex-1 text-center"
						>
							Download
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.diagram-item-container {
		content-visibility: auto;
		contain-intrinsic-size: 0 140px;
	}
</style>
