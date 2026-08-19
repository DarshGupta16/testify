<script lang="ts">
import { downloadImage, formatBytes } from '$lib/utils';

interface LightboxImage {
	title: string;
	src: string;
	width?: number;
	height?: number;
	sizeBytes?: number;
	info?: string;
}

const {
	image = null,
	onclose,
}: {
	image: LightboxImage | null;
	onclose: () => void;
} = $props();

function handleKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape' && image) {
		onclose();
	}
}

function handleDownload() {
	if (!image) return;
	const safeName = image.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
	downloadImage(image.src, `${safeName}.png`);
}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if image}
	<div
		class="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
		onclick={(e) => {
			if (e.target === e.currentTarget) onclose();
		}}
		role="presentation"
	>
		<div
			class="neo-box-lg max-w-4xl max-h-[94vh] w-full bg-surface p-3.5 sm:p-4 flex flex-col space-y-3 animate-slide-down"
			role="dialog"
			aria-modal="true"
			aria-label={image.title}
			tabindex="-1"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b-2 border-border-color pb-2.5 font-mono">
				<div class="truncate pr-2 sm:pr-3">
					<h4 class="text-xs sm:text-sm font-bold text-text-primary uppercase truncate">{image.title}</h4>
					<p class="text-[10px] sm:text-[11px] text-text-muted mt-0.5">
						{#if image.info}
							{image.info}
						{:else if image.width && image.height}
							{image.width} &times; {image.height} px
							{#if image.sizeBytes}
								&bull; {formatBytes(image.sizeBytes)}
							{/if}
						{/if}
					</p>
				</div>
				<div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
					<button
						type="button"
						onclick={handleDownload}
						class="neo-btn text-xs py-1 px-2 sm:px-3 font-bold truncate"
						title="Download image asset"
					>
						<span class="hidden sm:inline">Download </span>PNG
					</button>
					<button
						type="button"
						onclick={onclose}
						class="neo-btn text-xs py-1 px-2.5"
						aria-label="Close lightbox"
					>
						✕
					</button>
				</div>
			</div>

			<!-- Image Display Container -->
			<div class="flex-1 flex items-center justify-center bg-white p-2 border-2 border-border-color overflow-auto max-h-[72vh]">
				<img
					src={image.src}
					alt={image.title}
					class="max-w-full max-h-[68vh] object-contain mx-auto"
				/>
			</div>
		</div>
	</div>
{/if}
