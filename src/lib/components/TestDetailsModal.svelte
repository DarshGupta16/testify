<script lang="ts">
import { getTestStore } from '$lib/stores/testStore.svelte';

const store = getTestStore();

function handleStartSimulatedExam() {
	if (store.selectedTest) {
		store.showToast(
			`Starting test session for "${store.selectedTest.title}"... (Simulated)`,
			'info'
		);
		store.closeDetailsModal();
	}
}

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		store.closeDetailsModal();
	}
}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if store.isDetailsModalOpen && store.selectedTest}
	{@const test = store.selectedTest}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				store.closeDetailsModal();
			}
		}}
		role="presentation"
	>
		<!-- Modal Content -->
		<div
			class="neo-box-lg w-full max-w-3xl bg-surface p-6 sm:p-8 animate-slide-down max-h-[90vh] overflow-y-auto"
			role="dialog"
			aria-modal="true"
			aria-labelledby="details-modal-title"
		>
			<!-- Modal Header -->
			<div class="flex items-start justify-between border-b-2 border-border-color pb-4 mb-6">
				<div>
					<div class="flex items-center gap-2 mb-1.5">
						<span class="neo-badge bg-accent-contrast text-accent-contrast-text">
							{test.subject}
						</span>
						{#if test.hasAnswerKey}
							<span class="neo-badge bg-emerald-500 text-white">
								✓ Answer Key Active
							</span>
						{:else}
							<span class="neo-badge bg-muted text-text-muted">
								Self-Review Mode
							</span>
						{/if}
					</div>
					<h2 id="details-modal-title" class="text-xl sm:text-2xl font-black uppercase tracking-tight text-text-primary">
						{test.title}
					</h2>
				</div>

				<button
					type="button"
					onclick={() => store.closeDetailsModal()}
					class="neo-btn text-xs py-1 px-2.5"
					aria-label="Close details"
				>
					✕
				</button>
			</div>

			<!-- Specs Grid -->
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/40 border-2 border-border-color mb-6 font-mono">
				<div>
					<span class="text-[10px] text-text-muted uppercase block font-bold">Total Duration</span>
					<span class="text-base font-black text-text-primary">{test.durationMinutes} Minutes</span>
				</div>
				<div>
					<span class="text-[10px] text-text-muted uppercase block font-bold">Questions</span>
					<span class="text-base font-black text-text-primary">{test.questionCount} Items</span>
				</div>
				<div>
					<span class="text-[10px] text-text-muted uppercase block font-bold">Total Marks</span>
					<span class="text-base font-black text-text-primary">{test.totalMarks} Points</span>
				</div>
				<div>
					<span class="text-[10px] text-text-muted uppercase block font-bold">PDF Source</span>
					<span class="text-xs font-bold text-text-primary truncate block">{test.testFileName}</span>
				</div>
			</div>

			<!-- Question Structure & Extracted Sample -->
			<div class="mb-6">
				<div class="flex items-center justify-between mb-3">
					<h3 class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
						<span class="h-2 w-2 bg-accent-contrast"></span>
						Extracted Questions Preview ({test.questions?.length || 0} shown)
					</h3>
					<span class="font-mono text-[10px] text-text-muted">Parser Ready</span>
				</div>

				<div class="space-y-3 max-h-72 overflow-y-auto pr-1">
					{#if test.questions && test.questions.length > 0}
						{#each test.questions as q}
							<div class="neo-box-sm p-3.5 bg-surface text-sm space-y-2">
								<div class="flex items-center justify-between font-mono text-xs">
									<span class="font-bold text-text-primary">Question #{q.questionNumber}</span>
									<span class="text-[11px] text-text-muted uppercase">[{q.type.replace('_', ' ')}] • {q.marks} Marks</span>
								</div>
								<p class="text-xs text-text-secondary">{q.text}</p>
								{#if q.options}
									<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
										{#each q.options as opt}
											<div class="p-1.5 bg-muted/60 border border-border-color/30 text-xs font-mono">
												{opt}
											</div>
										{/each}
									</div>
								{/if}
								{#if q.correctAnswer && test.hasAnswerKey}
									<div class="font-mono text-[11px] text-emerald-600 font-bold pt-1">
										✓ Linked Solution: {q.correctAnswer}
									</div>
								{/if}
							</div>
						{/each}
					{:else}
						<div class="p-4 border-2 border-dashed border-border-color text-center font-mono text-xs text-text-muted">
							Full question set will render inside the interactive test runner.
						</div>
					{/if}
				</div>
			</div>

			<!-- Modal Footer Actions -->
			<div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t-2 border-border-color">
				<button
					type="button"
					onclick={() => store.deleteTest(test.id)}
					class="neo-btn text-xs py-2 px-3 text-red-500 hover:bg-red-500 hover:text-white w-full sm:w-auto"
				>
					Delete Assessment
				</button>

				<div class="flex items-center gap-2 w-full sm:w-auto">
					<button
						type="button"
						onclick={() => store.closeDetailsModal()}
						class="neo-btn text-xs py-2 px-4 flex-1 sm:flex-none"
					>
						Close
					</button>
					<button
						type="button"
						onclick={handleStartSimulatedExam}
						class="neo-btn neo-btn-primary text-xs py-2 px-5 flex-1 sm:flex-none"
					>
						Launch Test &rarr;
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
