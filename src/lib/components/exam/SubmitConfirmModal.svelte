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
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in"
		onclick={(e) => {
			if (e.target === e.currentTarget) oncancel();
		}}
		role="presentation"
	>
		<div
			class="neo-box-lg w-full max-w-md bg-surface p-6 sm:p-7 animate-slide-down space-y-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="submit-modal-title"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b-2 border-border-color pb-3">
				<div class="flex items-center gap-2">
					<div class="h-3.5 w-3.5 bg-accent-contrast"></div>
					<h3 id="submit-modal-title" class="text-base sm:text-lg font-black uppercase text-text-primary">
						{mode === 'practice' ? 'Finish Practice Session?' : 'Submit Examination?'}
					</h3>
				</div>
				<button
					type="button"
					onclick={oncancel}
					class="neo-btn text-xs py-1 px-2"
					aria-label="Close dialog"
				>
					✕
				</button>
			</div>

			<!-- Notice text -->
			<p class="text-xs text-text-secondary">
				{mode === 'practice'
					? 'Are you ready to conclude this practice session and view your complete scorecard with detailed solutions?'
					: 'Are you sure you want to end and submit your exam? Your final score and step-by-step solutions will be generated.'}
			</p>

			<!-- Summary Stats Grid -->
			<div class="grid grid-cols-3 gap-2 p-3 bg-muted/40 border-2 border-border-color font-mono text-center">
				<div>
					<span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase block">Answered</span>
					<span class="text-lg font-black text-emerald-600 dark:text-emerald-400">{answeredCount}</span>
				</div>
				<div>
					<span class="text-[10px] text-rose-500 font-bold uppercase block">Unanswered</span>
					<span class="text-lg font-black text-rose-500">{unansweredCount}</span>
				</div>
				<div>
					<span class="text-[10px] text-amber-500 font-bold uppercase block">Marked</span>
					<span class="text-lg font-black text-amber-500">{markedCount}</span>
				</div>
			</div>

			{#if unansweredCount > 0 && mode === 'exam'}
				<div class="p-2.5 bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-600 dark:text-rose-400 font-mono">
					⚠️ Notice: You still have {unansweredCount} unattempted questions out of {totalCount}.
				</div>
			{/if}

			<!-- Action Buttons -->
			<div class="flex items-center justify-end gap-2 pt-2 border-t border-border-color/20">
				<button
					type="button"
					onclick={oncancel}
					class="neo-btn text-xs py-2 px-4"
				>
					Continue Test
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
