<script lang="ts">
import type { QueueMode } from '$lib/types/queue';

let {
	mode = $bindable<QueueMode>('sequential'),
	concurrency = $bindable<number>(1),
}: {
	mode: QueueMode;
	concurrency: number;
} = $props();
</script>

<div class="p-3.5 bg-muted/30 border-2 border-border-color/60 space-y-3">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-1.5">
			<span class="inline-block h-2 w-2 bg-accent-contrast rounded-full"></span>
			<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
				Queue Execution Mode & Concurrency
			</span>
		</div>
	</div>

	<!-- Mode Selection Radios -->
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
		<label class={`neo-box-sm p-2.5 flex items-start gap-2.5 cursor-pointer transition-colors ${mode === 'sequential' ? 'bg-accent-contrast/15 border-accent-contrast' : 'bg-surface hover:bg-muted/20'}`}>
			<input
				type="radio"
				name="queue-mode-option"
				value="sequential"
				bind:group={mode}
				class="mt-0.5 accent-accent-contrast"
			/>
			<div class="space-y-0.5 text-xs">
				<p class="font-bold text-text-primary">Sequential (1-by-1)</p>
				<p class="text-[11px] text-text-muted">Generates one paper at a time. Ideal for free tiers & preventing API rate limits.</p>
			</div>
		</label>

		<label class={`neo-box-sm p-2.5 flex items-start gap-2.5 cursor-pointer transition-colors ${mode === 'concurrent' ? 'bg-accent-contrast/15 border-accent-contrast' : 'bg-surface hover:bg-muted/20'}`}>
			<input
				type="radio"
				name="queue-mode-option"
				value="concurrent"
				bind:group={mode}
				class="mt-0.5 accent-accent-contrast"
			/>
			<div class="space-y-0.5 text-xs">
				<p class="font-bold text-text-primary">Concurrent (Parallel)</p>
				<p class="text-[11px] text-text-muted">Processes multiple papers simultaneously using a background worker pool.</p>
			</div>
		</label>
	</div>

	<!-- Concurrency Input (If Concurrent Mode) -->
	{#if mode === 'concurrent'}
		<div class="pt-2 border-t border-border-color/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
			<div class="space-y-0.5">
				<label for="queue-concurrency-bar-input" class="font-mono text-xs font-bold uppercase text-text-primary">
					Worker Concurrency Count
				</label>
				<p class="text-[11px] text-text-muted">
					Number of simultaneous background workers processing papers.
				</p>
			</div>
			<input
				id="queue-concurrency-bar-input"
				type="number"
				min="1"
				step="1"
				bind:value={concurrency}
				class="neo-input w-24 h-9 text-xs font-mono font-bold text-center bg-surface"
			/>
		</div>

		<!-- Uncapped Concurrency Advisory Warning (if > 3) -->
		{#if concurrency > 3}
			<div class="neo-box p-3 bg-amber-500/15 border-2 border-amber-500 shadow-[2px_2px_0px_var(--shadow-color)] flex items-start gap-2.5 animate-slide-down">
				<span class="text-amber-700 dark:text-amber-300 font-mono text-sm font-black">⚡</span>
				<div class="space-y-0.5 text-[11px]">
					<p class="font-sans font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
						High Concurrency Advisory
					</p>
					<p class="text-text-primary leading-relaxed">
						Running more than 3 simultaneous jobs may lead to high RAM/CPU usage during PDF processing and provider API rate limits.
					</p>
				</div>
			</div>
		{/if}
	{/if}
</div>
