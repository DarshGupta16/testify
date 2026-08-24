<script lang="ts">
import type { AttemptTimingStats } from '$lib/services/assessmentEvaluator';
import type { TestAttempt } from '$lib/types/test';
import { formatDate, formatSecondsToText } from '$lib/utils';

const {
	attempt,
	timingStats = null,
	filterCounts,
	onexitreview,
	onretakepractice,
	onretakeexam,
}: {
	attempt: TestAttempt;
	timingStats: AttemptTimingStats | null;
	filterCounts: {
		total: number;
		correct: number;
		partial: number;
		incorrect: number;
		unattempted: number;
		marked: number;
	};
	onexitreview: () => void;
	onretakepractice: () => void;
	onretakeexam: () => void;
} = $props();
</script>

<div class="neo-box-lg p-4 sm:p-8 bg-surface space-y-4 sm:space-y-6">
	<!-- Top Title & Navigation Actions Row -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 border-b-2 border-border-color pb-4 sm:pb-5">
		<div>
			<div class="flex items-center gap-2 mb-1.5 font-mono text-xs">
				<span class="neo-badge bg-accent-contrast text-accent-contrast-text">
					{attempt.mode === 'practice' ? '🌿 Practice Review' : '🎯 Exam Scorecard'}
				</span>
				<span class="text-text-muted text-[11px]">
					{formatDate(attempt.completedAt || attempt.startedAt)}
				</span>
			</div>
			<h2 class="text-lg sm:text-3xl font-black uppercase tracking-tight text-text-primary break-words">
				{attempt.testTitle}
			</h2>
		</div>

		<!-- Exit & Retake Actions -->
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto mt-2 md:mt-0">
			<button
				type="button"
				onclick={onexitreview}
				class="neo-btn text-xs py-2 px-3 text-center truncate"
			>
				&larr; Return to Hub
			</button>
			<button
				type="button"
				onclick={onretakepractice}
				class="neo-btn text-xs py-2 px-3 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 text-center truncate"
			>
				Retake Practice
			</button>
			<button
				type="button"
				onclick={onretakeexam}
				class="neo-btn neo-btn-primary text-xs py-2 px-3 text-center truncate font-bold"
			>
				Retake Exam
			</button>
		</div>
	</div>

	<!-- High-Level Score Stats Grid -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 font-mono">
		<div class="border-2 border-border-color bg-muted/40 p-3 sm:p-4">
			<span class="text-[10px] sm:text-[11px] text-text-muted uppercase font-bold block">Final Score</span>
			<div class="flex items-baseline gap-1 mt-1">
				<span class="text-xl sm:text-4xl font-black text-text-primary">{attempt.score}</span>
				<span class="text-xs text-text-muted">/ {attempt.maxPossibleScore}</span>
			</div>
		</div>

		<div class="border-2 border-border-color bg-muted/40 p-3 sm:p-4">
			<span class="text-[10px] sm:text-[11px] text-text-muted uppercase font-bold block">Percentage</span>
			<div class="flex items-baseline gap-1 mt-1">
				<span class="text-xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400">
					{attempt.maxPossibleScore > 0 ? Math.round((Math.max(0, attempt.score) / attempt.maxPossibleScore) * 100) : 0}%
				</span>
			</div>
		</div>

		<div class="border-2 border-border-color bg-muted/40 p-3 sm:p-4">
			<span class="text-[10px] sm:text-[11px] text-text-muted uppercase font-bold block">Accuracy</span>
			<div class="flex items-baseline gap-1 mt-1">
				<span class="text-xl sm:text-4xl font-black text-text-primary">{attempt.accuracyPercentage}%</span>
				<span class="text-[10px] sm:text-[11px] text-text-muted font-bold">({attempt.correctCount}/{attempt.answeredCount})</span>
			</div>
		</div>

		<div class="border-2 border-border-color bg-muted/40 p-3 sm:p-4">
			<span class="text-[10px] sm:text-[11px] text-text-muted uppercase font-bold block">Time Taken</span>
			<div class="flex items-baseline gap-1 mt-1">
				<span class="text-lg sm:text-3xl font-black text-text-primary">
					{formatSecondsToText(attempt.durationSecondsTaken)}
				</span>
			</div>
		</div>
	</div>

	<!-- Question Result Breakdown Row -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
		<div class="p-3 border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-between">
			<span class="font-bold text-emerald-700 dark:text-emerald-300 uppercase">Correct:</span>
			<span class="font-black text-base text-emerald-700 dark:text-emerald-300">{filterCounts.correct}</span>
		</div>

		<div class="p-3 border border-amber-500/40 bg-amber-500/10 flex items-center justify-between">
			<span class="font-bold text-amber-700 dark:text-amber-300 uppercase">Partial:</span>
			<span class="font-black text-base text-amber-700 dark:text-amber-300">{filterCounts.partial}</span>
		</div>

		<div class="p-3 border border-rose-500/40 bg-rose-500/10 flex items-center justify-between">
			<span class="font-bold text-rose-700 dark:text-rose-300 uppercase">Incorrect:</span>
			<span class="font-black text-base text-rose-700 dark:text-rose-300">{filterCounts.incorrect}</span>
		</div>

		<div class="p-3 border border-border-color/40 bg-muted/40 flex items-center justify-between">
			<span class="font-bold text-text-muted uppercase">Unattempted:</span>
			<span class="font-black text-base text-text-secondary">{filterCounts.unattempted}</span>
		</div>
	</div>

	<!-- Per-Question Timing Analysis -->
	{#if timingStats}
		<div class="p-4 bg-muted/30 border-2 border-border-color/60 font-mono text-xs space-y-2">
			<span class="font-bold uppercase text-text-primary block text-[11px]">
				⏱️ Speed & Time Analytics
			</span>
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
				<div>
					<span class="text-[10px] text-text-muted uppercase block">Average Pace / Question</span>
					<span class="font-bold text-text-primary">{formatSecondsToText(timingStats.avgSecs)}</span>
				</div>
				<div>
					<span class="text-[10px] text-text-muted uppercase block">Fastest Question</span>
					<span class="font-bold text-emerald-600 dark:text-emerald-400">
						Q#{timingStats.fastestQNumber} ({formatSecondsToText(timingStats.fastestSecs)})
					</span>
				</div>
				<div>
					<span class="text-[10px] text-text-muted uppercase block">Longest Time Spent</span>
					<span class="font-bold text-amber-600 dark:text-amber-400">
						Q#{timingStats.slowestQNumber} ({formatSecondsToText(timingStats.slowestSecs)})
					</span>
				</div>
			</div>
		</div>
	{/if}
</div>
