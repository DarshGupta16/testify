<script lang="ts">
import type { EvaluationMode, ExamViewMode } from '$lib/services/settings';

let {
	viewMode = 'focus',
	evaluationMode = 'exam',
	positiveMarks = 4,
	negativeMarks = 1,
}: {
	viewMode: ExamViewMode;
	evaluationMode: EvaluationMode;
	positiveMarks: number;
	negativeMarks: number;
} = $props();

let selectedOption = $state<string | null>(null);
let activeQuestionIndex = $state<number>(0);

const sampleOptions = [
	{ id: 'A', text: 'π / 4', isCorrect: true },
	{ id: 'B', text: 'π / 2', isCorrect: false },
	{ id: 'C', text: '0', isCorrect: false },
	{ id: 'D', text: '1', isCorrect: false },
];

function selectOption(id: string) {
	selectedOption = id;
}

function resetPreview() {
	selectedOption = null;
}
</script>

<div class="neo-box bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] p-4 sm:p-5 space-y-4">
	<!-- Mini Preview Top Bar -->
	<div class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border-color pb-3">
		<div class="flex items-center gap-2">
			<span class="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
			<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
				Live Exam Player Preview
			</span>
			<span class="neo-badge text-[9px] uppercase font-bold bg-muted/60 text-text-muted">
				Interactive
			</span>
		</div>

		<div class="flex items-center gap-2">
			<span class="neo-badge text-[10px] font-mono font-bold bg-accent-contrast/10 text-accent-contrast border-accent-contrast/30">
				+{positiveMarks} / -{negativeMarks}
			</span>
			<button
				type="button"
				onclick={resetPreview}
				class="font-mono text-[10px] text-text-muted hover:text-text-primary underline cursor-pointer"
			>
				Reset
			</button>
		</div>
	</div>

	<!-- Mode Indicators Banner -->
	<div class="flex flex-wrap items-center gap-2 font-mono text-[11px]">
		<div class="flex items-center gap-1.5 px-2 py-0.5 bg-muted/40 border border-border-color/60">
			<span class="text-text-muted">Layout:</span>
			<span class="font-bold uppercase text-accent-contrast">
				{viewMode === 'focus' ? 'Single Question Focus' : 'Continuous Paper'}
			</span>
		</div>

		<div class="flex items-center gap-1.5 px-2 py-0.5 bg-muted/40 border border-border-color/60">
			<span class="text-text-muted">Feedback:</span>
			<span class="font-bold uppercase {evaluationMode === 'study' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-500'}">
				{evaluationMode === 'study' ? 'Practice (Instant Solutions)' : 'Exam (Masked Feedback)'}
			</span>
		</div>
	</div>

	<!-- Main Preview Area -->
	<div class="grid grid-cols-1 {viewMode === 'focus' ? 'lg:grid-cols-4' : ''} gap-3 pt-1">
		<!-- Question Box Container -->
		<div class="{viewMode === 'focus' ? 'lg:col-span-3' : 'w-full'} space-y-3">
			<!-- Question 1 Card -->
			<div class="neo-box p-3.5 sm:p-4 bg-muted/20 border-2 border-border-color space-y-3">
				<div class="flex items-center justify-between text-xs font-mono">
					<span class="font-bold text-text-primary">Question 1</span>
					<span class="text-text-muted">Definite Integrals</span>
				</div>

				<p class="font-sans text-xs sm:text-sm text-text-primary leading-relaxed font-medium">
					Evaluate the definite integral: <code class="font-mono text-xs px-1.5 py-0.5 bg-surface border border-border-color">∫₀^(π/2) [sin³(x) / (sin³(x) + cos³(x))] dx</code>
				</p>

				<!-- Options Grid -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
					{#each sampleOptions as option (option.id)}
						{@const isSelected = selectedOption === option.id}
						{@const showCorrect = evaluationMode === 'study' && selectedOption && option.isCorrect}
						{@const showWrong = evaluationMode === 'study' && isSelected && !option.isCorrect}

						<button
							type="button"
							onclick={() => selectOption(option.id)}
							class="text-left p-2.5 border-2 text-xs font-mono transition-all flex items-center justify-between {showCorrect
								? 'bg-emerald-500/20 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-bold'
								: showWrong
									? 'bg-rose-500/20 border-rose-500 text-rose-800 dark:text-rose-200 font-bold'
									: isSelected
										? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast font-bold shadow-[2px_2px_0px_var(--shadow-color)]'
										: 'bg-surface hover:bg-muted/50 border-border-color text-text-primary'}"
						>
							<div class="flex items-center gap-2">
								<span
									class="inline-flex h-5 w-5 items-center justify-center border font-bold text-[10px] {isSelected
										? 'border-accent-contrast-text bg-accent-contrast-text text-accent-contrast'
										: 'border-border-color bg-muted/40 text-text-primary'}"
								>
									{option.id}
								</span>
								<span>{option.text}</span>
							</div>

							{#if showCorrect}
								<span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ Correct</span>
							{:else if showWrong}
								<span class="text-xs font-bold text-rose-600 dark:text-rose-400">✕ Incorrect</span>
							{/if}
						</button>
					{/each}
				</div>

				<!-- Feedback or Lock Notice -->
				{#if selectedOption}
					{#if evaluationMode === 'study'}
						<div class="neo-box p-3 bg-emerald-500/10 border-2 border-emerald-500 text-xs font-mono space-y-1 animate-slide-down">
							<div class="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
								<span>💡</span>
								<span>Instant Solution & Explanation:</span>
							</div>
							<p class="text-text-secondary text-[11px] leading-relaxed">
								By King's property: <code class="text-[10px]">∫_a^b f(x)dx = ∫_a^b f(a+b-x)dx</code>. Adding the two integrals gives <code class="text-[10px]">2I = ∫₀^(π/2) 1 dx = π/2 ⇒ I = π/4</code>.
							</p>
						</div>
					{:else}
						<div class="neo-box p-2.5 bg-muted/40 border border-border-color text-[11px] font-mono text-text-muted flex items-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5 text-text-secondary shrink-0">
								<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
								<path d="M7 11V7a5 5 0 0 1 10 0v4" />
							</svg>
							<span>Exam Mode: Answer recorded. Full solutions and marking will be shown after submission.</span>
						</div>
					{/if}
				{/if}

				<!-- Question Controls in Focus Mode -->
				{#if viewMode === 'focus'}
					<div class="flex items-center justify-between pt-1 border-t border-border-color/30">
						<button
							type="button"
							class="neo-btn py-1 px-2.5 text-[11px] font-mono font-bold uppercase disabled:opacity-40"
							disabled
						>
							← Prev
						</button>
						<span class="font-mono text-[10px] text-text-muted">1 of 5 Questions</span>
						<button
							type="button"
							class="neo-btn py-1 px-2.5 text-[11px] font-mono font-bold uppercase bg-accent-contrast text-accent-contrast-text"
						>
							Next →
						</button>
					</div>
				{/if}
			</div>

			<!-- Additional Stacked Question in Continuous Paper View -->
			{#if viewMode === 'paper'}
				<div class="neo-box p-3.5 sm:p-4 bg-muted/10 border-2 border-border-color/60 space-y-2 opacity-80">
					<div class="flex items-center justify-between text-xs font-mono">
						<span class="font-bold text-text-secondary">Question 2</span>
						<span class="text-text-muted">Matrices</span>
					</div>
					<p class="font-sans text-xs text-text-secondary">
						If A is a square matrix such that A² = A, find (I + A)³ - 7A...
					</p>
					<div class="flex items-center gap-2 font-mono text-[10px] text-text-muted italic">
						<span>↓ Continuous paper stream view active</span>
					</div>
				</div>
			{/if}
		</div>

		<!-- Question Palette Navigator (in Focus Mode) -->
		{#if viewMode === 'focus'}
			<div class="neo-box p-3 bg-muted/30 border-2 border-border-color space-y-2.5 self-start">
				<span class="font-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary block border-b border-border-color pb-1">
					Question Palette
				</span>

				<div class="grid grid-cols-5 gap-1.5 font-mono text-xs text-center">
					<div
						class="py-1.5 font-bold border-2 {selectedOption
							? 'bg-emerald-500 text-white border-emerald-600'
							: 'bg-accent-contrast text-accent-contrast-text border-accent-contrast'}"
					>
						1
					</div>
					<div class="py-1.5 bg-surface border border-border-color text-text-muted">2</div>
					<div class="py-1.5 bg-surface border border-border-color text-text-muted">3</div>
					<div class="py-1.5 bg-surface border border-border-color text-text-muted">4</div>
					<div class="py-1.5 bg-surface border border-border-color text-text-muted">5</div>
				</div>

				<div class="space-y-1 text-[9px] font-mono text-text-muted pt-1">
					<div class="flex items-center gap-1.5">
						<span class="h-2 w-2 bg-emerald-500 border border-emerald-600 inline-block"></span>
						<span>Answered ({selectedOption ? '1' : '0'})</span>
					</div>
					<div class="flex items-center gap-1.5">
						<span class="h-2 w-2 bg-surface border border-border-color inline-block"></span>
						<span>Unanswered ({selectedOption ? '4' : '5'})</span>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
