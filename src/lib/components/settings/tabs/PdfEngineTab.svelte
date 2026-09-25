<script lang="ts">
import ToggleSwitch from '$lib/components/common/ToggleSwitch.svelte';
import type { KatexFontSize } from '$lib/services/settings';
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();
</script>

<div class="neo-box p-4 sm:p-6 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] space-y-6">
	<div class="border-b-2 border-border-color pb-3">
		<h2 class="font-sans text-lg font-extrabold uppercase tracking-tight">
			PDF Extraction & Math Engine
		</h2>
		<p class="font-mono text-xs text-text-muted">
			MuPDF WebAssembly scale, asset retention, and mathematical formula rendering
		</p>
	</div>

	<div class="space-y-5">
		<!-- Render Scale (Synchronized with app.selectedScale) -->
		<div class="space-y-2">
			<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
				Default MuPDF Extraction Scale
			</span>
			<p class="font-mono text-xs text-text-muted">
				Controls the resolution at which PDF pages and embedded diagrams are rasterized. Higher scales increase clarity for dense mathematical symbols at the cost of processing memory.
			</p>

			<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
				{#each [1.0, 1.25, 1.5, 2.0] as scale}
					<button
						type="button"
						onclick={() => app.setScale(scale)}
						class="p-3 border-2 font-mono text-xs font-bold uppercase transition-all text-center {app.selectedScale === scale
							? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)]'
							: 'bg-surface hover:bg-muted/50 border-border-color text-text-primary'}"
					>
						<div class="text-sm">{scale}x</div>
						<div class="text-[10px] opacity-80 mt-0.5">
							{scale === 1.0 ? 'Fastest' : scale === 1.25 ? 'Default' : scale === 1.5 ? 'Sharp' : 'Ultra-Dense'}
						</div>
					</button>
				{/each}
			</div>
		</div>

		<!-- Canvas Page Asset Retention -->
		<div class="pt-4 border-t border-border-color/40 flex items-start justify-between gap-4">
			<div class="space-y-1">
				<label for="auto-purge-toggle" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block cursor-pointer select-none">
					Auto-Purge Page Background Canvases
				</label>
				<p class="font-mono text-xs text-text-muted leading-relaxed">
					When enabled, full-page background images (5–20 MB per paper) are deleted from local storage after questions are generated. Cropped diagram figures are always safely retained.
				</p>
			</div>

			<ToggleSwitch
				id="auto-purge-toggle"
				ariaLabel="Auto-Purge Page Background Canvases"
				class="shrink-0 mt-1"
				checked={app.settings.autoPurgePageCanvases}
				onchange={(checked) => app.settings.setAutoPurgePageCanvases(checked)}
			/>
		</div>

		<!-- KaTeX Font Sizing -->
		<div class="pt-4 border-t border-border-color/40 space-y-2">
			<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
				KaTeX Math Display Size
			</span>
			<div class="inline-flex border-2 border-border-color bg-surface shadow-[2px_2px_0px_var(--shadow-color)]">
				{#each (['standard', 'large', 'extra-large'] as KatexFontSize[]) as size}
					<button
						type="button"
						onclick={() => app.settings.setKatexFontSize(size)}
						class="px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors {app.settings.katexFontSize === size
							? 'bg-accent-contrast text-accent-contrast-text'
							: 'text-text-muted hover:text-text-primary hover:bg-muted'}"
					>
						{size}
					</button>
				{/each}
			</div>
		</div>
	</div>
</div>
