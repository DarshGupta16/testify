<script lang="ts">
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import ExamScorecardReview from '$lib/components/exam/ExamScorecardReview.svelte';
import ExamSessionRunner from '$lib/components/exam/ExamSessionRunner.svelte';
import TestOverviewHub from '$lib/components/exam/TestOverviewHub.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { TestAttempt, TestMode } from '$lib/types/test';

const app = getAppContext();

// URL params
const testId = $derived(page.params.test_id);
const shouldStartImmediately = $derived(page.url.searchParams.get('start') === 'true');
const initialModeParam = $derived(page.url.searchParams.get('mode') as TestMode | null);

// Resolved Test Item & Attempts
const test = $derived(app.tests.tests.find((t) => t.id === testId));
const testAttempts = $derived(testId ? app.attempts.getAttemptsForTest(testId, 'all') : []);
const testStats = $derived(
	testId ? app.attempts.getStatsForTest(testId, test?.totalMarks || 0) : null
);

// High-level session orchestration states
let isExamActive = $state<boolean>(false);
let activeTestMode = $state<TestMode>('exam');
let reviewingAttempt = $state<TestAttempt | null>(null);

onMount(() => {
	if (shouldStartImmediately && test && (test.questions?.length || 0) > 0) {
		activeTestMode = initialModeParam === 'practice' ? 'practice' : 'exam';
		isExamActive = true;
		reviewingAttempt = null;
	}
});

function handleStartPractice() {
	if (!test || (test.questions?.length || 0) === 0) {
		app.toast.show('Cannot start practice: No questions found in this assessment.', 'error');
		return;
	}
	activeTestMode = 'practice';
	reviewingAttempt = null;
	isExamActive = true;
}

function handleStartExam() {
	if (!test || (test.questions?.length || 0) === 0) {
		app.toast.show('Cannot start exam: No questions found in this assessment.', 'error');
		return;
	}
	activeTestMode = 'exam';
	reviewingAttempt = null;
	isExamActive = true;
}

function handleExamComplete(attempt: TestAttempt) {
	isExamActive = false;
	reviewingAttempt = attempt;
	app.toast.show(
		`${attempt.mode === 'practice' ? 'Practice session completed!' : 'Exam submitted!'} Score: ${attempt.score} / ${attempt.maxPossibleScore}`,
		'success',
		6000
	);
}

function handleExitReview() {
	reviewingAttempt = null;
	isExamActive = false;
}

function handleDeleteAttempt(attemptId: string) {
	app.attempts.deleteAttempt(attemptId);
	app.toast.show('Attempt record deleted.', 'info');
}

function handleDeleteTest() {
	if (!test) return;
	app.handleDeleteTest(test.id);
	goto('/');
}

const pageTitle = $derived(
	test
		? isExamActive
			? `[${activeTestMode === 'practice' ? 'PRACTICE' : 'EXAM'}] ${test.title} — Testify`
			: reviewingAttempt
				? `[REVIEW] ${test.title} — Testify`
				: `${test.title} — Testify`
		: 'Assessment Not Found — Testify'
);
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
	{#if !test}
		<!-- Assessment Not Found State -->
		<div class="mx-auto max-w-4xl py-16 text-center animate-fade-in">
			<div class="neo-box p-8 sm:p-12 bg-surface space-y-4">
				<div class="mx-auto flex h-16 w-16 items-center justify-center border-2 border-border-color bg-muted">
					<span class="text-2xl font-mono">⚠️</span>
				</div>
				<h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-text-primary">
					Assessment Not Found
				</h1>
				<p class="text-sm text-text-secondary max-w-md mx-auto">
					The requested examination could not be loaded. It may have been deleted or the link is invalid.
				</p>
				<div class="pt-4">
					<a href="/" class="neo-btn neo-btn-primary text-xs py-2 px-5 inline-flex items-center gap-2">
						<span>&larr; Return to Dashboard</span>
					</a>
				</div>
			</div>
		</div>

	{:else if isExamActive}
		<!-- Active Examination or Practice Runner -->
		<ExamSessionRunner
			{test}
			mode={activeTestMode}
			onexamcomplete={handleExamComplete}
			onexamexit={() => (isExamActive = false)}
		/>

	{:else if reviewingAttempt}
		<!-- Scorecard Review View -->
		<ExamScorecardReview
			{test}
			attempt={reviewingAttempt}
			onexitreview={handleExitReview}
			onretakepractice={handleStartPractice}
			onretakeexam={handleStartExam}
		/>

	{:else}
		<!-- Test Overview Hub & Past Attempts Tab View -->
		<TestOverviewHub
			{test}
			attempts={testAttempts}
			stats={testStats}
			onstartpractice={handleStartPractice}
			onstartexam={handleStartExam}
			onviewattempt={(att) => (reviewingAttempt = att)}
			ondeleteattempt={handleDeleteAttempt}
			ondeletetest={handleDeleteTest}
		/>
	{/if}
</div>
