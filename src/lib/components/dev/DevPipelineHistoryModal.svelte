<script lang="ts">
import { db } from '$lib/services/db';
import type { DevPipelineTrace } from '$lib/types/devTrace';
import DevPipelineTraceViewer from './DevPipelineTraceViewer.svelte';

let {
	isOpen = $bindable(false),
	initialTestId,
	onclose,
}: {
	isOpen: boolean;
	initialTestId?: string;
	onclose?: () => void;
} = $props();

let traces = $state<DevPipelineTrace[]>([]);
let selectedTrace = $state<DevPipelineTrace | null>(null);
let searchQuery = $state('');
let isLoading = $state(true);

$effect(() => {
	if (isOpen) {
		loadTraces();
	}
});

async function loadTraces() {
	isLoading = true;
	try {
		traces = await db.getAllDevTraces();
		if (initialTestId) {
			const found = traces.find((t) => t.testId === initialTestId || t.id === initialTestId);
			selectedTrace = found || traces[0] || null;
		} else if (!selectedTrace && traces.length > 0) {
			selectedTrace = traces[0];
		}
	} catch (err) {
		console.error('Failed to load dev traces:', err);
	} finally {
		isLoading = false;
	}
}

async function handleDeleteTrace(id: string) {
	try {
		await db.deleteDevTrace(id);
		traces = traces.filter((t) => t.id !== id);
		if (selectedTrace?.id === id) {
			selectedTrace = traces[0] || null;
		}
	} catch (err) {
		console.error('Failed to delete dev trace:', err);
	}
}

async function handleClearAll() {
	if (!confirm('Are you sure you want to clear all dev pipeline traces?')) return;
	try {
		await db.clearAllDevTraces();
		traces = [];
		selectedTrace = null;
	} catch (err) {
		console.error('Failed to clear all dev traces:', err);
	}
}

function handleClose() {
	isOpen = false;
	onclose?.();
}

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		handleClose();
	}
}

const filteredTraces = $derived(
	traces.filter(
		(t) =>
			t.testTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
			t.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
			t.model.toLowerCase().includes(searchQuery.toLowerCase())
	)
);
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if isOpen}
	<div
		role="presentation"
		class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
		onclick={(e) => {
			if (e.target === e.currentTarget) handleClose();
		}}
	>
		<div class="neo-box w-full max-w-7xl h-[92vh] flex flex-col bg-surface overflow-hidden">
			<!-- Modal Header -->
			<div class="flex items-center justify-between p-3 sm:p-4 border-b-2 border-border-color bg-muted/30 shrink-0">
				<div class="flex items-center gap-2">
					<span class="text-lg sm:text-xl">⚡</span>
					<div>
						<h2 class="text-sm sm:text-base font-black text-text-primary font-mono uppercase tracking-wider">
							Dev AI Pipeline Inspector
						</h2>
						<span class="text-[11px] text-text-muted font-mono">
							Localhost development trace history stored in IndexedDB ({traces.length} Total Sessions)
						</span>
					</div>
				</div>

				<div class="flex items-center gap-2">
					{#if traces.length > 0}
						<button
							type="button"
							onclick={handleClearAll}
							class="neo-btn text-xs py-1 px-2 text-rose-500 hover:bg-rose-500 hover:text-white font-mono"
							title="Clear all saved traces"
						>
							🗑️ Clear Traces
						</button>
					{/if}
					<button
						type="button"
						onclick={handleClose}
						class="neo-btn text-xs py-1.5 px-3 font-mono font-bold"
					>
						✕ Close
					</button>
				</div>
			</div>

			<!-- Modal Body (Two-Pane Layout) -->
			<div class="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
				<!-- Left Sidebar: Session List -->
				<div class="w-full md:w-80 border-b-2 md:border-b-0 md:border-r-2 border-border-color flex flex-col bg-muted/10 shrink-0">
					<div class="p-2 border-b border-border-color/40">
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Search past traces..."
							class="w-full neo-input text-xs py-1.5 px-2.5 font-mono"
						/>
					</div>

					<div class="flex-1 overflow-y-auto p-2 space-y-1.5">
						{#if isLoading}
							<div class="p-4 text-center font-mono text-xs text-text-muted">Loading dev traces...</div>
						{:else if filteredTraces.length === 0}
							<div class="p-4 text-center font-mono text-xs text-text-muted">
								No dev pipeline traces found. Generate a test to record a pipeline run.
							</div>
						{:else}
							{#each filteredTraces as item}
								<div
									class={`w-full text-left p-2 border-2 font-mono text-xs transition-all flex items-start justify-between gap-1.5 ${
										selectedTrace?.id === item.id
											? 'border-border-color bg-surface neo-box font-bold shadow-xs'
											: 'border-transparent hover:border-border-color/40 hover:bg-surface/50'
									}`}
								>
									<button
										type="button"
										class="min-w-0 space-y-1 flex-1 text-left cursor-pointer"
										onclick={() => (selectedTrace = item)}
									>
										<div class="flex items-center gap-1.5 flex-wrap">
											<span class="neo-badge bg-primary/20 text-[10px]">
												{item.provider}
											</span>
											<span class="text-[10px] text-text-muted">
												{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
											</span>
										</div>
										<h4 class="font-bold text-xs truncate text-text-primary" title={item.testTitle}>
											{item.testTitle}
										</h4>
										<div class="text-[10px] text-text-muted flex items-center gap-2">
											<span>{item.stages.normalization.questionsCount} Qs</span>
											<span>•</span>
											<span>{item.stages.extraction.totalDiagrams} Figs</span>
											<span>•</span>
											<span>{item.totalDurationMs}ms</span>
										</div>
									</button>

									<button
										type="button"
										onclick={() => handleDeleteTrace(item.id)}
										class="text-text-muted hover:text-rose-500 text-xs p-1 shrink-0"
										title="Delete this trace"
									>
										🗑️
									</button>
								</div>
							{/each}
						{/if}
					</div>
				</div>

				<!-- Right Main Pane: Full Interactive Trace Inspector -->
				<div class="flex-1 min-h-0 bg-surface overflow-hidden">
					{#if selectedTrace}
						<DevPipelineTraceViewer trace={selectedTrace} />
					{:else}
						<div class="h-full flex flex-col items-center justify-center p-8 text-center font-mono text-xs text-text-muted space-y-2">
							<span class="text-3xl">🔍</span>
							<p>Select a pipeline trace from the sidebar to inspect its execution breakdown.</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
