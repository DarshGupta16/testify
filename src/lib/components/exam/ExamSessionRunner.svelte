<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import ImageLightboxModal from '$lib/components/common/ImageLightboxModal.svelte';
import {
	calculateExamMetrics,
	createInitialResponses,
	evaluateAttempt,
	hasResponseAnswer,
} from '$lib/services/assessmentEvaluator';
import { getAppContext } from '$lib/stores/appContext.svelte';
import type {
	QuestionPreview,
	TestAttempt,
	TestItem,
	TestMode,
	UserQuestionResponse,
} from '$lib/types/test';
import { formatDigitalTimer } from '$lib/utils';
import ExamQuestionCard from './ExamQuestionCard.svelte';
import ExamQuestionPalette from './ExamQuestionPalette.svelte';
import SubmitConfirmModal from './SubmitConfirmModal.svelte';

const {
	test,
	mode = 'exam',
	onexamcomplete,
	onexamexit,
}: {
	test: TestItem;
	mode?: TestMode;
	onexamcomplete: (attempt: TestAttempt) => void;
	onexamexit: () => void;
} = $props();

const app = getAppContext();

const testQuestions = $derived<QuestionPreview[]>(test?.questions || []);

// Session state
let currentAttemptId = $state<string>('');
let currentQuestionIndex = $state<number>(0);
let userResponses = $state<Record<string, UserQuestionResponse>>({});
let examStartedAt = $state<number>(Date.now());
let timeRemainingSeconds = $state<number | null>(null);
let elapsedTimeSeconds = $state<number>(0);
let timerInterval: ReturnType<typeof setInterval> | null = null;

// Practice Mode toggles
let showHint = $state<boolean>(false);
let showPracticeSolution = $state<boolean>(false);

// Modals
let isSubmitConfirmModalOpen = $state<boolean>(false);
let zoomedImage = $state<{ title: string; src: string; info?: string } | null>(null);

// Palette Filter
let paletteFilter = $state<'all' | 'attempted' | 'unattempted' | 'marked'>('all');

// Current question and response
const currentQuestion = $derived(testQuestions[currentQuestionIndex]);
const currentResponse = $derived<UserQuestionResponse | undefined>(
	currentQuestion ? userResponses[currentQuestion.id] : undefined
);

// Metrics
const metrics = $derived.by(() => calculateExamMetrics(testQuestions, userResponses));

// Filtered question palette indices
const filteredQuestionIndices = $derived.by(() => {
	return testQuestions
		.map((q, idx) => ({ q, idx }))
		.filter(({ q }) => {
			const resp = userResponses[q.id];
			const hasAnswer = hasResponseAnswer(resp);
			if (paletteFilter === 'attempted') return hasAnswer;
			if (paletteFilter === 'unattempted') return !hasAnswer;
			if (paletteFilter === 'marked') return resp?.isMarkedForReview;
			return true;
		})
		.map(({ idx }) => idx);
});

// Timer formatting
const timerDisplay = $derived.by(() => {
	if (mode === 'practice' || timeRemainingSeconds === null) {
		return formatDigitalTimer(elapsedTimeSeconds);
	}
	const initialMins = test?.durationMinutes || 0;
	const forceHours = initialMins >= 60 || timeRemainingSeconds >= 3600;
	return formatDigitalTimer(timeRemainingSeconds, forceHours);
});

const isTimerUrgent = $derived(
	mode === 'exam' &&
		timeRemainingSeconds !== null &&
		timeRemainingSeconds > 0 &&
		timeRemainingSeconds <= 300
);
const isTimerWarning = $derived(
	mode === 'exam' &&
		timeRemainingSeconds !== null &&
		timeRemainingSeconds > 300 &&
		timeRemainingSeconds <= 600
);

// Internal question timing tracker decoupled from reactive state
const questionTimeSpent: Record<string, number> = {};

onMount(() => {
	currentAttemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
	examStartedAt = Date.now();
	currentQuestionIndex = 0;
	elapsedTimeSeconds = 0;
	showHint = false;
	showPracticeSolution = false;
	paletteFilter = 'all';

	userResponses = createInitialResponses(testQuestions);
	for (const q of testQuestions) {
		questionTimeSpent[q.id] = 0;
	}

	if (mode === 'exam' && test.durationMinutes && test.durationMinutes > 0) {
		timeRemainingSeconds = test.durationMinutes * 60;
	} else {
		timeRemainingSeconds = null;
	}

	if (timerInterval) clearInterval(timerInterval);
	timerInterval = setInterval(() => {
		elapsedTimeSeconds++;

		if (testQuestions[currentQuestionIndex]) {
			const activeQId = testQuestions[currentQuestionIndex].id;
			questionTimeSpent[activeQId] = (questionTimeSpent[activeQId] || 0) + 1;
		}

		if (mode === 'exam' && timeRemainingSeconds !== null) {
			timeRemainingSeconds--;
			if (timeRemainingSeconds <= 0) {
				timeRemainingSeconds = 0;
				if (timerInterval) clearInterval(timerInterval);
				app.toast.show('Time is up! Submitting examination automatically...', 'warning', 6000);
				handleSubmitExam();
			}
		}
	}, 1000);
});

onDestroy(() => {
	if (timerInterval) clearInterval(timerInterval);
});

// Single option select
function handleSelectSingleOption(optionId: string) {
	if (!currentQuestion) return;
	const qId = currentQuestion.id;
	const existing = userResponses[qId] || { questionId: qId, visited: true, timeSpentSeconds: 0 };
	const isCurrentlySelected = existing.selectedOptionId === optionId;

	userResponses[qId] = {
		...existing,
		visited: true,
		selectedOptionId: isCurrentlySelected ? undefined : optionId,
		selectedOptionIds: isCurrentlySelected ? [] : [optionId],
	};
}

// Multi option toggle
function handleToggleMultiOption(optionId: string) {
	if (!currentQuestion) return;
	const qId = currentQuestion.id;
	const existing = userResponses[qId] || { questionId: qId, visited: true, timeSpentSeconds: 0 };
	const currentList =
		existing.selectedOptionIds || (existing.selectedOptionId ? [existing.selectedOptionId] : []);

	const nextList = currentList.includes(optionId)
		? currentList.filter((id) => id !== optionId)
		: [...currentList, optionId];

	userResponses[qId] = {
		...existing,
		visited: true,
		selectedOptionIds: nextList,
		selectedOptionId: nextList[0],
	};
}

// Numerical input
function handleNumericalInput(value: string) {
	if (!currentQuestion) return;
	const qId = currentQuestion.id;
	const existing = userResponses[qId] || { questionId: qId, visited: true, timeSpentSeconds: 0 };

	userResponses[qId] = {
		...existing,
		visited: true,
		numericalAnswer: value,
	};
}

// Clear response
function handleClearResponse() {
	if (!currentQuestion) return;
	const qId = currentQuestion.id;
	const existing = userResponses[qId] || { questionId: qId, visited: true, timeSpentSeconds: 0 };

	userResponses[qId] = {
		...existing,
		selectedOptionId: undefined,
		selectedOptionIds: [],
		numericalAnswer: undefined,
	};
	showPracticeSolution = false;
}

// Toggle Review
function handleToggleReview() {
	if (!currentQuestion) return;
	const qId = currentQuestion.id;
	const existing = userResponses[qId] || { questionId: qId, visited: true, timeSpentSeconds: 0 };

	userResponses[qId] = {
		...existing,
		isMarkedForReview: !existing.isMarkedForReview,
	};
}

// Jump to Question
function goToQuestion(index: number) {
	if (index < 0 || index >= testQuestions.length) return;
	currentQuestionIndex = index;
	showHint = false;
	showPracticeSolution = false;

	const targetQ = testQuestions[index];
	if (targetQ) {
		const existing = userResponses[targetQ.id] || { questionId: targetQ.id, timeSpentSeconds: 0 };
		userResponses[targetQ.id] = {
			...existing,
			visited: true,
		};
	}
}

function handleNextQuestion() {
	if (currentQuestionIndex < testQuestions.length - 1) {
		goToQuestion(currentQuestionIndex + 1);
	} else {
		isSubmitConfirmModalOpen = true;
	}
}

function handleMarkAndNext() {
	handleToggleReview();
	handleNextQuestion();
}

function handlePreviousQuestion() {
	if (currentQuestionIndex > 0) {
		goToQuestion(currentQuestionIndex - 1);
	}
}

// Submit Examination
function handleSubmitExam() {
	if (timerInterval) clearInterval(timerInterval);
	isSubmitConfirmModalOpen = false;

	// Synchronize exact time spent per question into responses before evaluation
	const syncedResponses: Record<string, UserQuestionResponse> = {};
	for (const [qId, resp] of Object.entries(userResponses)) {
		syncedResponses[qId] = {
			...resp,
			timeSpentSeconds: questionTimeSpent[qId] ?? resp.timeSpentSeconds ?? 0,
		};
	}

	const completedAttempt = evaluateAttempt({
		test,
		userResponses: syncedResponses,
		elapsedTimeSeconds,
		mode,
		attemptId: currentAttemptId,
		examStartedAt,
	});

	app.attempts.recordAttempt(completedAttempt);
	onexamcomplete(completedAttempt);
}

function handleKeyDown(e: KeyboardEvent) {
	if (isSubmitConfirmModalOpen || zoomedImage) return;

	if (
		e.key === 'ArrowRight' &&
		!['input', 'textarea'].includes((e.target as HTMLElement)?.tagName.toLowerCase())
	) {
		handleNextQuestion();
	} else if (
		e.key === 'ArrowLeft' &&
		!['input', 'textarea'].includes((e.target as HTMLElement)?.tagName.toLowerCase())
	) {
		handlePreviousQuestion();
	}
}
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="min-h-screen bg-canvas flex flex-col">
	<!-- Fixed Sticky Top Navigation Header -->
	<header class="sticky top-0 z-30 bg-surface border-b-2 border-border-color shadow-sm px-3 sm:px-6 py-2.5 sm:py-3">
		<div class="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
			<!-- Title & Mode Badge -->
			<div class="flex items-center gap-1.5 sm:gap-2.5 truncate">
				{#if mode === 'practice'}
					<span class="neo-badge bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50 shrink-0 text-[10px] font-bold">
						🌿 Practice
					</span>
				{:else}
					<span class="neo-badge bg-accent-contrast text-accent-contrast-text shrink-0 text-[10px] font-bold">
						🎯 Exam
					</span>
				{/if}
				<h1 class="text-xs sm:text-base font-black uppercase tracking-tight text-text-primary truncate" title={test.title}>
					{test.title}
				</h1>
			</div>

			<!-- Live Timer & Submission CTA -->
			<div class="flex items-center gap-2 sm:gap-3 shrink-0">
				<!-- Timer Box -->
				<div
					class={`flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 border-2 font-mono font-black text-xs sm:text-sm transition-colors ${
						mode === 'practice'
							? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
							: isTimerUrgent
								? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500 animate-pulse'
								: isTimerWarning
									? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500'
									: 'bg-muted border-border-color text-text-primary'
					}`}
					title={mode === 'practice' ? 'Elapsed Practice Time' : 'Remaining Time'}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="square"
						class="h-3.5 w-3.5 shrink-0"
					>
						<circle cx="12" cy="12" r="10" />
						<polyline points="12 6 12 12 16 14" />
					</svg>
					<span>{timerDisplay}</span>
					{#if mode === 'practice'}
						<span class="text-[9px] uppercase font-normal opacity-80 hidden min-[480px]:inline">(Untimed)</span>
					{/if}
				</div>

				<!-- Progress Summary -->
				<span class="hidden sm:inline-flex font-mono text-xs font-bold text-text-muted">
					{metrics.answered}/{metrics.total} Done
				</span>

				<!-- Submit CTA -->
				<button
					type="button"
					onclick={() => (isSubmitConfirmModalOpen = true)}
					class="neo-btn neo-btn-primary text-xs py-1.5 px-2.5 sm:px-3.5 whitespace-nowrap font-bold"
				>
					<span>{mode === 'practice' ? 'Finish' : 'Submit'}<span class="hidden min-[480px]:inline">{mode === 'practice' ? ' Practice' : ' Exam'}</span></span>
				</button>
			</div>
		</div>
	</header>

	<!-- Main Two-Column Workspace Layout -->
	<div class="flex-1 max-w-7xl mx-auto w-full p-3.5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
		<!-- LEFT COLUMN: Active Question Display (Col 8/12) -->
		<div class="lg:col-span-8 flex flex-col gap-4">
			{#if currentQuestion}
				<ExamQuestionCard
					question={currentQuestion}
					questionIndex={currentQuestionIndex}
					totalQuestions={testQuestions.length}
					response={currentResponse}
					{mode}
					{showHint}
					{showPracticeSolution}
					onselectsingle={handleSelectSingleOption}
					ontogglemulti={handleToggleMultiOption}
					oninputnumerical={handleNumericalInput}
					onclearresponse={handleClearResponse}
					ontogglereview={handleToggleReview}
					ontogglehint={() => (showHint = !showHint)}
					ontogglesolution={() => (showPracticeSolution = !showPracticeSolution)}
					onnext={handleNextQuestion}
					onprevious={handlePreviousQuestion}
					onmarkandnext={handleMarkAndNext}
					onzoom={(item) => (zoomedImage = item)}
				/>
			{/if}
		</div>

		<!-- RIGHT COLUMN: Question Navigation Palette (Col 4/12) -->
		<div class="lg:col-span-4">
			<ExamQuestionPalette
				questions={testQuestions}
				currentIndex={currentQuestionIndex}
				{userResponses}
				{paletteFilter}
				filteredIndices={filteredQuestionIndices}
				{mode}
				onselectquestion={goToQuestion}
				onsetpalettefilter={(f) => (paletteFilter = f)}
				onopensubmit={() => (isSubmitConfirmModalOpen = true)}
			/>
		</div>
	</div>

	<!-- Modals -->
	<SubmitConfirmModal
		isOpen={isSubmitConfirmModalOpen}
		{mode}
		answeredCount={metrics.answered}
		unansweredCount={metrics.unanswered}
		markedCount={metrics.marked}
		totalCount={metrics.total}
		onconfirm={handleSubmitExam}
		oncancel={() => (isSubmitConfirmModalOpen = false)}
	/>

	<ImageLightboxModal
		image={zoomedImage}
		onclose={() => (zoomedImage = null)}
	/>
</div>
