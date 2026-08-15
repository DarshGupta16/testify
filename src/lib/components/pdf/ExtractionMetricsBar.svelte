<script lang="ts">
import type { PdfExtractionResult } from '$lib/services/pdf/types';
import { formatBytes } from '$lib/utils';

const {
	result,
	onuploadanother,
	onclear,
}: {
	result: PdfExtractionResult;
	onuploadanother: () => void;
	onclear: () => void;
} = $props();
</script>

<div class="neo-box p-5 bg-surface">
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-color/40 pb-4 mb-4">
		<div>
			<div class="flex items-center gap-2">
				<span class="font-mono text-xs font-bold text-accent-contrast uppercase">
					Extraction Complete
				</span>
				<span class="text-xs text-text-muted">•</span>
				<span class="text-xs font-mono text-text-secondary">
					Scale factor: {result.scale}x
				</span>
			</div>
			<h2 class="text-lg sm:text-xl font-black uppercase text-text-primary truncate max-w-xl">
				{result.fileName}
			</h2>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={onuploadanother}
				class="neo-btn text-xs py-1.5 px-3"
			>
				Upload Another PDF
			</button>
			<button
				type="button"
				onclick={onclear}
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
				{result.totalPages}
			</div>
		</div>

		<div class="border-2 border-border-color bg-muted/40 p-3">
			<div class="font-mono text-[10px] uppercase text-text-muted font-bold">Diagrams / Images</div>
			<div class="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
				{result.totalEmbeddedImages}
			</div>
		</div>

		<div class="border-2 border-border-color bg-muted/40 p-3">
			<div class="font-mono text-[10px] uppercase text-text-muted font-bold">File Size</div>
			<div class="font-mono text-xl font-black text-text-primary mt-0.5">
				{formatBytes(result.fileSizeBytes)}
			</div>
		</div>

		<div class="border-2 border-border-color bg-muted/40 p-3">
			<div class="font-mono text-[10px] uppercase text-text-muted font-bold">Extraction Time</div>
			<div class="font-mono text-xl font-black text-accent-contrast mt-0.5">
				{result.durationMs} ms
			</div>
		</div>
	</div>
</div>
