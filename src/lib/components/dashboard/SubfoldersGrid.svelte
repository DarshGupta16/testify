<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import FolderCard from './FolderCard.svelte';

const app = getAppContext();

let isExpanded = $state(false);

const subfolders = $derived(app.folders.subfolders);
const hasMoreThanLimit = $derived(subfolders.length > 6);

// On mobile/collapsed view, cap display to first 6 items unless expanded
const displayedSubfolders = $derived(
	hasMoreThanLimit && !isExpanded ? subfolders.slice(0, 6) : subfolders
);
</script>

{#if subfolders.length > 0}
	<section aria-label="Subfolders Section" class="space-y-3">
		<!-- Section Header with Count and Mobile Expand Toggle -->
		<div class="flex items-center justify-between pb-1.5 border-b-2 border-border-color/20">
			<div class="flex items-center gap-2">
				<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
					<span>📁</span>
					<span>Subfolders ({subfolders.length})</span>
				</span>
			</div>

			{#if hasMoreThanLimit}
				<button
					type="button"
					onclick={() => (isExpanded = !isExpanded)}
					class="font-mono text-xs font-bold text-text-secondary hover:text-text-primary underline cursor-pointer"
				>
					{isExpanded
						? 'Show Less ↑'
						: `Show All ${subfolders.length} Subfolders ↓`}
				</button>
			{/if}
		</div>

		<!-- Responsive Grid -->
		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
			{#each displayedSubfolders as folder (folder.id)}
				<FolderCard {folder} />
			{/each}
		</div>

		{#if hasMoreThanLimit && !isExpanded}
			<div class="text-center pt-1">
				<button
					type="button"
					onclick={() => (isExpanded = true)}
					class="neo-btn text-xs py-1.5 px-4 font-mono font-bold cursor-pointer"
				>
					View {subfolders.length - 6} more subfolders ↓
				</button>
			</div>
		{/if}
	</section>
{/if}
