<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { GenerationJob } from '$lib/types/queue';

const app = getAppContext();

function handleViewTest(job: GenerationJob) {
	if (!job.resultTestId) return;
	const test = app.tests.tests.find((t) => t.id === job.resultTestId);
	if (test) {
		app.modals.openDetails(test);
	}
}
</script>

{#if app.queue.jobs.length > 0}
	<div class="fixed bottom-4 right-4 z-40 flex flex-col items-end pointer-events-auto">
		<!-- 1. Expanded Queue Drawer -->
		{#if app.queue.isDrawerOpen}
			<div
				class="neo-box-lg w-[340px] sm:w-[420px] max-w-[calc(100vw-2rem)] bg-surface p-4 mb-2 animate-slide-down max-h-[75vh] flex flex-col shadow-[6px_6px_0px_var(--shadow-color)] border-3 border-border-color"
				role="region"
				aria-label="Background generation jobs drawer"
			>
				<!-- Drawer Header -->
				<div class="flex items-center justify-between border-b-2 border-border-color pb-3 mb-3">
					<div class="flex items-center gap-2">
						<span class="flex h-3.5 w-3.5 bg-accent-contrast"></span>
						<h3 class="font-extrabold text-xs sm:text-sm uppercase tracking-wide text-text-primary">
							Generation Queue ({app.queue.jobs.length})
						</h3>
					</div>
					<div class="flex items-center gap-1.5">
						{#if app.queue.completedJobs.length > 0 || app.queue.failedJobs.length > 0}
							<button
								type="button"
								onclick={() => app.queue.clearCompleted()}
								class="text-[10px] font-mono text-text-muted hover:text-text-primary hover:underline px-1.5 py-0.5"
								title="Clear all completed and failed jobs"
							>
								Clear Finished
							</button>
						{/if}
						<button
							type="button"
							onclick={() => app.queue.toggleDrawer(false)}
							class="neo-btn text-[10px] py-0.5 px-2"
							aria-label="Collapse drawer"
						>
							✕
						</button>
					</div>
				</div>

				<!-- Quick Mode & Concurrency Bar -->
				<div class="p-2.5 bg-muted/30 border border-border-color/60 mb-3 space-y-2">
					<div class="flex items-center justify-between gap-2 text-xs">
						<span class="font-mono text-[10px] font-bold uppercase text-text-muted">
							Mode:
						</span>
						<div class="flex items-center gap-1">
							<button
								type="button"
								onclick={() => app.queue.setMode('sequential')}
								class={`text-[10px] font-mono font-bold px-2 py-0.5 border border-border-color transition-colors ${
									app.queue.mode === 'sequential'
										? 'bg-accent-contrast text-accent-contrast-text'
										: 'bg-surface text-text-muted hover:bg-muted/40'
								}`}
							>
								Sequential
							</button>
							<button
								type="button"
								onclick={() => app.queue.setMode('concurrent')}
								class={`text-[10px] font-mono font-bold px-2 py-0.5 border border-border-color transition-colors ${
									app.queue.mode === 'concurrent'
										? 'bg-accent-contrast text-accent-contrast-text'
										: 'bg-surface text-text-muted hover:bg-muted/40'
								}`}
							>
								Concurrent
							</button>
						</div>
					</div>

					{#if app.queue.mode === 'concurrent'}
						<div class="flex items-center justify-between gap-2 pt-1 border-t border-border-color/20 text-xs">
							<label for="drawer-concurrency" class="font-mono text-[10px] font-bold uppercase text-text-muted">
								Concurrency:
							</label>
							<input
								id="drawer-concurrency"
								type="number"
								min="1"
								step="1"
								value={app.queue.concurrency}
								oninput={(e) => app.queue.setConcurrency(Number(e.currentTarget.value) || 1)}
								class="neo-input w-16 h-6 text-[11px] font-mono font-bold text-center bg-surface"
							/>
						</div>

						{#if app.queue.concurrency > 3}
							<div class="p-1.5 bg-amber-500/15 border border-amber-500 text-[10px] text-amber-800 dark:text-amber-300 font-sans">
								⚡ <strong>High Concurrency:</strong> >3 workers may cause high RAM/CPU usage during PDF processing.
							</div>
						{/if}
					{/if}
				</div>

				<!-- Jobs Scrollable List -->
				<div class="overflow-y-auto space-y-2.5 flex-1 pr-1 max-h-[48vh]">
					{#each app.queue.jobs as job (job.id)}
						<div class="neo-box-sm p-3 bg-surface border-2 border-border-color space-y-2 text-xs">
							<!-- Job Header: Title & Status Badge -->
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0 flex-1">
									<p class="font-bold text-text-primary truncate text-xs">
										{job.title || job.testFileName}
									</p>
									<p class="font-mono text-[10px] text-text-muted truncate">
										{#if job.jobType === 'similar_paper'}
											{job.sourceTestTitle ? `From "${job.sourceTestTitle}"` : 'Similar Paper'} • {job.targetQuestionCount ? `${job.targetQuestionCount} Questions` : 'Biphasic AI'}
										{:else}
											{job.testFileName || 'Document'} • {job.testFileSizeFormatted || 'PDF'}
										{/if}
									</p>
								</div>

								<!-- Status Badge -->
								{#if job.status === 'processing'}
									<span class="neo-badge bg-accent-contrast text-accent-contrast-text text-[9px] py-0.5 px-1.5 animate-pulse font-bold">
										Processing ({job.progress}%)
									</span>
								{:else if job.status === 'queued'}
									<span class="neo-badge bg-muted text-text-muted text-[9px] py-0.5 px-1.5 font-bold">
										Queued
									</span>
								{:else if job.status === 'paused'}
									<span class="neo-badge bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50 text-[9px] py-0.5 px-1.5 font-bold">
										Paused
									</span>
								{:else if job.status === 'completed'}
									<span class="neo-badge bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50 text-[9px] py-0.5 px-1.5 font-bold">
										✓ Ready
									</span>
								{:else if job.status === 'failed'}
									<span class="neo-badge bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/50 text-[9px] py-0.5 px-1.5 font-bold">
										✕ Failed
									</span>
								{:else if job.status === 'cancelled'}
									<span class="neo-badge bg-muted text-text-muted text-[9px] py-0.5 px-1.5 font-bold">
										Cancelled
									</span>
								{/if}
							</div>

							<!-- Progress Bar (for Processing / Paused) -->
							{#if job.status === 'processing' || job.status === 'paused'}
								<div class="space-y-1">
									<div class="h-2 w-full border border-border-color bg-surface overflow-hidden">
										<div
											class="h-full bg-accent-contrast transition-all duration-300"
											style={`width: ${job.progress}%`}
										></div>
									</div>
									<p class="font-mono text-[10px] text-text-muted truncate">
										{job.statusText}
									</p>
								</div>
							{:else if job.status === 'failed'}
								<p class="font-mono text-[10px] text-rose-600 dark:text-rose-400 truncate">
									{job.error || 'Failed to process document'}
								</p>
							{/if}

							<!-- Job Action Buttons -->
							<div class="flex items-center justify-end gap-1.5 pt-1.5 border-t border-border-color/20">
								{#if job.status === 'processing' || job.status === 'queued' || job.status === 'paused'}
									<button
										type="button"
										onclick={() => app.queue.cancelJob(job.id)}
										class="neo-btn text-[10px] py-0.5 px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
									>
										Cancel
									</button>
									{#if job.status === 'paused'}
										<button
											type="button"
											onclick={() => app.queue.removeJob(job.id)}
											class="neo-btn text-[10px] py-0.5 px-1.5 text-text-muted hover:text-rose-500"
											title="Remove paused job"
										>
											✕
										</button>
									{/if}
								{:else if job.status === 'failed' || job.status === 'cancelled'}
									<button
										type="button"
										onclick={() => app.queue.retryJob(job.id)}
										class="neo-btn neo-btn-primary text-[10px] py-0.5 px-2 font-bold"
									>
										↻ Retry
									</button>
									<button
										type="button"
										onclick={() => app.queue.removeJob(job.id)}
										class="neo-btn text-[10px] py-0.5 px-1.5 text-text-muted hover:text-rose-500"
										title="Remove job"
									>
										✕
									</button>
								{:else if job.status === 'completed'}
									<button
										type="button"
										onclick={() => handleViewTest(job)}
										class="neo-btn neo-btn-primary text-[10px] py-0.5 px-2.5 font-bold"
									>
										View Test →
									</button>
									<button
										type="button"
										onclick={() => app.queue.removeJob(job.id)}
										class="neo-btn text-[10px] py-0.5 px-1.5 text-text-muted hover:text-text-primary"
										title="Dismiss"
									>
										✕
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- 2. Collapsed Floating Pill Trigger Button -->
		<button
			type="button"
			onclick={() => app.queue.toggleDrawer()}
			class={`px-3.5 py-2 flex items-center gap-2.5 font-mono text-xs font-bold cursor-pointer transition-all hover:translate-x-0.5 hover:translate-y-0.5 border-2 shadow-[4px_4px_0px_var(--shadow-color)] ${
				app.queue.activeCount > 0
					? 'bg-accent-contrast text-accent-contrast-text border-border-color'
					: app.queue.failedJobs.length > 0
						? 'bg-rose-500 text-white border-border-color'
						: app.queue.pausedJobs.length > 0
							? 'bg-surface text-amber-700 dark:text-amber-300 border-amber-500'
							: 'bg-surface text-text-primary border-border-color'
			}`}
			aria-expanded={app.queue.isDrawerOpen}
			aria-label="Toggle background generation queue"
		>
			{#if app.queue.activeCount > 0}
				<span class="inline-block h-2.5 w-2.5 bg-current animate-spin"></span>
				<span class="text-accent-contrast-text">
					Generating {app.queue.activeCount}/{app.queue.incompleteCount} ({app.queue.overallProgress}%)
				</span>
				<span class="bg-accent-contrast-text/20 text-accent-contrast-text text-[10px] px-1.5 py-0.5 rounded-xs font-bold uppercase">
					{app.queue.mode === 'sequential' ? 'SEQ' : `CONC:${app.queue.concurrency}`}
				</span>
			{:else if app.queue.pausedJobs.length > 0}
				<span class="text-amber-500">⚡</span>
				<span>
					{#if !app.network.isOnline}
						Queue Paused (Offline)
					{:else}
						Rate Limited (Retrying...)
					{/if}
				</span>
			{:else if app.queue.failedJobs.length > 0}
				<span>✕ {app.queue.failedJobs.length} Failed</span>
			{:else}
				<span class="text-emerald-500 font-bold">✓</span>
				<span>Queue ({app.queue.completedJobs.length} Ready)</span>
			{/if}

			<span class="text-[10px] opacity-75">
				{app.queue.isDrawerOpen ? '▼' : '▲'}
			</span>
		</button>
	</div>
{/if}
