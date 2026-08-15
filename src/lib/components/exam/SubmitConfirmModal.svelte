<script lang="ts">
import type { TestMode } from '$lib/types/test';

const {
	isOpen = false,
	mode = 'exam',
	answeredCount = 0,
	unansweredCount = 0,
	markedCount = 0,
	totalCount = 0,
	onconfirm,
	oncancel,
}: {
	isOpen: boolean;
	mode: TestMode;
	answeredCount: number;
	unansweredCount: number;
	markedCount: number;
	totalCount: number;
	onconfirm: () => void;
	oncancel: () => void;
} = $props();

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === 'Escape' && isOpen) {
		oncancel();
	}
}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fade-in"
		onclick={(e) => {
			if (e.target === e.currentTarget) oncancel();
		}}
		role="presentation"
	>
		<div
			class="neo-box-lg w-full max-w-lg bg-surface p-6 sm:p-7 space-y-5 animate-slide-down"
			role="dialog"
			aria-modal="true"
			aria-labelledby="submit-modal-title"
		>
			<div class="border-b-2 border-border-color pb-3">
				<div class="flex items-center gap-2 mb-1">
					{#if mode === 'practice'}
						<span class="neo-badge bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px]">
							🌿 Practice Mode
						</span>
					{:else}
						<span class="neo-badge bg-accent-contrast text-accent-contrast-text text-[10px]">
							🎯 Exam Simulation
						</span>
					{/if}
				</div>
				<h3 id="submit-modal-title" class="text-xl font-black uppercase tracking-tight text-text-primary">
					{mode === 'practice' ? 'End Practice Session?' : 'Submit Examination?'}
				</h3>
				<p class="text-xs text-text-secondary mt-0.5">
					Review your question status breakdown before finalizing:
				</p>
			</div>

			<!-- Status Overview Grid -->
			<div class="grid grid-cols-3 gap-3 bg-muted/40 p-4 border-2 border-border-color font-mono text-center text-xs">
				<div class="p-2 bg-surface border border-border-color/40 flex flex-col">
					<span class="text-[10px] text-text-muted uppercase font-bold">Attempted</span>
					<span class="text-xl font-black text-emerald-600 dark:text-emerald-400 my-0.5">
						{answeredCount}
					</span>
					<span class="text-[10px] text-text-muted">Questions</span>
				</div>
				<div class="p-2 bg-surface border border-border-color/40 flex flex-col">
					<span class="text-[10px] text-text-muted uppercase font-bold">Unattempted</span>
					<span class="text-xl font-black text-rose-500 my-0.5">
						{unansweredCount}
					</span>
					<span class="text-[10px] text-text-muted">Remaining</span>
				</div>
				<div class="p-2 bg-surface border border-border-color/40 flex flex-col">
					<span class="text-[10px] text-text-muted uppercase font-bold">Marked</span>
					<span class="text-xl font-black text-purple-600 dark:text-purple-400 my-0.5">
						{markedCount}
					</span>
					<span class="text-[10px] text-text-muted">For Review</span>
				</div>
			</div>

			{#if unansweredCount > 0}
				<div class="p-3 bg-amber-500/10 border-2 border-amber-500/50 text-xs font-mono text-amber-700 dark:text-amber-300">
					⚠️ You have {unansweredCount} unattempted questions that will receive 0 marks.
				</div>
			{/if}

			<div class="flex items-center justify-end gap-2 pt-3 border-t-2 border-border-color">
				<button
					type="button"
					onclick={oncancel}
					class="neo-btn text-xs py-2 px-4"
				>
					Return to Questions
				</button>
				<button
					type="button"
					onclick={onconfirm}
					class="neo-btn neo-btn-primary text-xs py-2 px-5"
				>
					Confirm & Submit
				</button>
			</div>
		</div>
	</div>
{/if}
