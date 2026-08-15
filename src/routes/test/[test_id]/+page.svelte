<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import ImageLightboxModal from '$lib/components/common/ImageLightboxModal.svelte';
import MathRenderer from '$lib/components/common/MathRenderer.svelte';
import type { ExtractedPdfPage } from '$lib/services/pdf';
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { QuestionPreview, TestAttempt, TestMode, UserQuestionResponse } from '$lib/types/test';
import { formatBytes, formatDate, formatDigitalTimer, formatSecondsToText } from '$lib/utils';

const app = getAppContext();

// URL params
const testId = $derived(page.params.test_id);
const shouldStartImmediately = $derived(page.url.searchParams.get('start') === 'true');
const initialModeParam = $derived(page.url.searchParams.get('mode') as TestMode | null);

// Resolved Test Item
const test = $derived(app.tests.tests.find((t) => t.id === testId));
const testQuestions = $derived<QuestionPreview[]>(test?.questions || []);
const allDiagrams = $derived(
	test?.extractedData?.pages?.flatMap((p: ExtractedPdfPage) => p.embeddedImages) || []
);
const allPages = $derived(test?.extractedData?.pages || []);

// Overview Tab state
let activeOverviewTab = $state<'attempts' | 'questions' | 'diagrams' | 'pages'>('attempts');
let attemptHistoryFilter = $state<'all' | 'exam' | 'practice'>('all');

// Past attempts for this test
const testAttempts = $derived(
	testId ? app.attempts.getAttemptsForTest(testId, attemptHistoryFilter) : []
);
const testStats = $derived(
	testId ? app.attempts.getStatsForTest(testId, test?.totalMarks || 0) : null
);

// Lightbox modal state
let zoomedImage = $state<{ title: string; src: string; info: string } | null>(null);

// Active Examination Session State
let isExamActive = $state<boolean>(false);
let activeTestMode = $state<TestMode>('exam');
let isReviewingSubmission = $state<boolean>(false);
let isSubmitConfirmModalOpen = $state<boolean>(false);

// Active Attempt Data
let currentAttemptId = $state<string>('');
let currentQuestionIndex = $state<number>(0);
let userResponses = $state<Record<string, UserQuestionResponse>>({});
let examStartedAt = $state<number>(Date.now());
let timeRemainingSeconds = $state<number | null>(null);
let elapsedTimeSeconds = $state<number>(0);
let timerInterval: ReturnType<typeof setInterval> | null = null;

// Practice Mode specific interactions
let showHint = $state<boolean>(false);
let showPracticeSolution = $state<boolean>(false);

// Palette Filter: 'all' | 'attempted' | 'unattempted' | 'marked'
let paletteFilter = $state<'all' | 'attempted' | 'unattempted' | 'marked'>('all');

// Selected attempt to inspect in review mode
let reviewingAttempt = $state<TestAttempt | null>(null);

// Active question helper
const currentQuestion = $derived(testQuestions[currentQuestionIndex]);
const currentResponse = $derived<UserQuestionResponse | undefined>(
	currentQuestion ? userResponses[currentQuestion.id] : undefined
);

// Helper to check if a response has an answer
function hasResponseAnswer(resp?: UserQuestionResponse): boolean {
	if (!resp) return false;
	if (resp.selectedOptionId) return true;
	if (resp.selectedOptionIds && resp.selectedOptionIds.length > 0) return true;
	if (resp.numericalAnswer && resp.numericalAnswer.trim().length > 0) return true;
	return false;
}

// Answered & Palette Metrics
const examMetrics = $derived.by(() => {
	let answered = 0;
	let marked = 0;
	let notVisited = 0;
	let notAnswered = 0;

	for (const q of testQuestions) {
		const resp = userResponses[q.id];
		const hasAnswer = hasResponseAnswer(resp);
		if (hasAnswer) {
			answered++;
		}
		if (resp?.isMarkedForReview) {
			marked++;
		}
		if (!resp?.visited) {
			notVisited++;
		} else if (!hasAnswer) {
			notAnswered++;
		}
	}

	return {
		answered,
		unanswered: testQuestions.length - answered,
		marked,
		notVisited,
		notAnswered,
		total: testQuestions.length,
	};
});

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

// Timer display with proper hours formatting
const timerDisplay = $derived.by(() => {
	if (activeTestMode === 'practice' || timeRemainingSeconds === null) {
		// Stopwatch elapsed time (auto includes hours if >= 1 hr)
		return formatDigitalTimer(elapsedTimeSeconds);
	}
	// Countdown: if test duration is >= 60 mins or time remaining >= 3600s, include hours (e.g. 01:59:52)
	const initialMins = test?.durationMinutes || 0;
	const forceHours = initialMins >= 60 || timeRemainingSeconds >= 3600;
	return formatDigitalTimer(timeRemainingSeconds, forceHours);
});

const isTimerUrgent = $derived(
	activeTestMode === 'exam' &&
		timeRemainingSeconds !== null &&
		timeRemainingSeconds > 0 &&
		timeRemainingSeconds <= 300 // < 5 mins
);
const isTimerWarning = $derived(
	activeTestMode === 'exam' &&
		timeRemainingSeconds !== null &&
		timeRemainingSeconds > 300 &&
		timeRemainingSeconds <= 600 // < 10 mins
);

// Start Exam / Practice Session
function startSession(mode: TestMode = 'exam') {
	if (!test || testQuestions.length === 0) {
		app.toast.show('Cannot start session: No questions available in this test.', 'error');
		return;
	}

	activeTestMode = mode;
	currentAttemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
	examStartedAt = Date.now();
	currentQuestionIndex = 0;
	elapsedTimeSeconds = 0;
	reviewingAttempt = null;
	isReviewingSubmission = false;
	showHint = false;
	showPracticeSolution = false;
	paletteFilter = 'all';

	// Initialize empty user responses with per-question time tracking
	const initialResponses: Record<string, UserQuestionResponse> = {};
	for (const q of testQuestions) {
		initialResponses[q.id] = {
			questionId: q.id,
			visited: false,
			isMarkedForReview: false,
			timeSpentSeconds: 0,
			selectedOptionIds: [],
		};
	}
	if (testQuestions[0]) {
		initialResponses[testQuestions[0].id].visited = true;
	}
	userResponses = initialResponses;

	// Timer Setup
	if (mode === 'exam' && test.durationMinutes && test.durationMinutes > 0) {
		timeRemainingSeconds = test.durationMinutes * 60;
	} else {
		timeRemainingSeconds = null;
	}

	if (timerInterval) clearInterval(timerInterval);
	timerInterval = setInterval(() => {
		elapsedTimeSeconds++;

		// Increment time spent on the active question
		if (testQuestions[currentQuestionIndex]) {
			const activeQId = testQuestions[currentQuestionIndex].id;
			if (userResponses[activeQId]) {
				userResponses[activeQId].timeSpentSeconds =
					(userResponses[activeQId].timeSpentSeconds || 0) + 1;
			}
		}

		// Countdown check for Exam Simulation mode
		if (activeTestMode === 'exam' && timeRemainingSeconds !== null) {
			timeRemainingSeconds--;
			if (timeRemainingSeconds <= 0) {
				timeRemainingSeconds = 0;
				if (timerInterval) clearInterval(timerInterval);
				app.toast.show('Time is up! Submitting examination automatically...', 'warning', 6000);
				submitExam();
			}
		}
	}, 1000);

	isExamActive = true;
}

// Select an option for Single-Choice Multiple Choice
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

// Toggle an option for Multi-Choice Multi-Correct Question
function handleToggleMultiOption(optionId: string) {
	if (!currentQuestion) return;
	const qId = currentQuestion.id;
	const existing = userResponses[qId] || { questionId: qId, visited: true, timeSpentSeconds: 0 };
	const currentList = existing.selectedOptionIds || (existing.selectedOptionId ? [existing.selectedOptionId] : []);

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

// Input numerical answer
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

// Toggle Mark for Review
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

// Submit and Score Examination with Multi-Correct Partial Marking
function submitExam() {
	if (!test) return;
	if (timerInterval) clearInterval(timerInterval);

	isSubmitConfirmModalOpen = false;

	let totalScore = 0;
	let maxPossibleScore = 0;
	let correctCount = 0;
	let incorrectCount = 0;
	let answeredCount = 0;
	let unattemptedCount = 0;
	let reviewCount = 0;

	const evaluatedResponses: Record<string, UserQuestionResponse> = {};

	for (const q of testQuestions) {
		maxPossibleScore += q.marks;
		const resp = userResponses[q.id] || { questionId: q.id, visited: false, timeSpentSeconds: 0 };
		let isCorrect = false;
		let isPartiallyCorrect = false;
		let marksAwarded = 0;

		const hasAnswer = hasResponseAnswer(resp);

		if (hasAnswer) {
			answeredCount++;

			if (q.type === 'multi_choice' || q.type === 'multiple_choice_multi') {
				// Multi-choice multi-correct evaluation with partial marking
				const correctList: string[] = q.correctAnswers || (q.correctAnswer ? [q.correctAnswer] : []);
				const userList: string[] = resp.selectedOptionIds || (resp.selectedOptionId ? [resp.selectedOptionId] : []);

				if (userList.length === 0) {
					// Unattempted
					marksAwarded = 0;
					unattemptedCount++;
				} else {
					// Check if any incorrect option was chosen
					const hasIncorrectChoice = userList.some((id) => !correctList.includes(id));

					if (hasIncorrectChoice) {
						// Incorrect: deduct negative marks
						isCorrect = false;
						isPartiallyCorrect = false;
						marksAwarded = -(q.negativeMarks || 0);
						incorrectCount++;
					} else {
						// All selected options are correct!
						if (userList.length === correctList.length && correctList.length > 0) {
							// All correct options chosen: full marks
							isCorrect = true;
							isPartiallyCorrect = false;
							marksAwarded = q.marks;
							correctCount++;
						} else if (correctList.length > 0) {
							// Partial marks: proportionally awarded
							isCorrect = false;
							isPartiallyCorrect = true;
							marksAwarded = Math.round((userList.length / correctList.length) * q.marks * 100) / 100;
							correctCount++;
						}
					}
				}
			} else if (q.type === 'single_choice' || q.type === 'multiple_choice') {
				// Standard single-choice MCQ
				if (q.correctAnswer && resp.selectedOptionId === q.correctAnswer) {
					isCorrect = true;
					marksAwarded = q.marks;
					correctCount++;
				} else {
					isCorrect = false;
					marksAwarded = -(q.negativeMarks || 0);
					incorrectCount++;
				}
			} else if (q.type === 'numerical') {
				// Numerical comparison with decimal tolerance
				const userNum = Number.parseFloat(resp.numericalAnswer || '');
				const correctNum = Number.parseFloat(q.correctAnswer || '');
				if (!Number.isNaN(userNum) && !Number.isNaN(correctNum) && Math.abs(userNum - correctNum) <= 0.01) {
					isCorrect = true;
					marksAwarded = q.marks;
					correctCount++;
				} else {
					isCorrect = false;
					marksAwarded = -(q.negativeMarks || 0);
					incorrectCount++;
				}
			}
		} else {
			unattemptedCount++;
			marksAwarded = 0;
		}

		if (resp.isMarkedForReview) {
			reviewCount++;
		}

		totalScore += marksAwarded;

		evaluatedResponses[q.id] = {
			...resp,
			isCorrect,
			isPartiallyCorrect,
			marksAwarded,
		};
	}

	const accuracyPercentage =
		answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

	const completedAttempt: TestAttempt = {
		id: currentAttemptId,
		testId: test.id,
		testTitle: test.title,
		startedAt: new Date(examStartedAt).toISOString(),
		completedAt: new Date().toISOString(),
		durationSecondsTaken: elapsedTimeSeconds,
		mode: activeTestMode,
		status: 'completed',
		responses: evaluatedResponses,
		score: Math.max(0, Math.round(totalScore * 100) / 100),
		maxPossibleScore,
		accuracyPercentage,
		totalQuestions: testQuestions.length,
		answeredCount,
		correctCount,
		incorrectCount,
		unattemptedCount,
		reviewCount,
	};

	// Save to Store and Dexie
	app.attempts.recordAttempt(completedAttempt);

	reviewingAttempt = completedAttempt;
	isExamActive = false;
	isReviewingSubmission = true;
	app.toast.show(
		`${activeTestMode === 'practice' ? 'Practice session completed!' : 'Exam submitted!'} Score: ${completedAttempt.score} / ${completedAttempt.maxPossibleScore}`,
		'success',
		6000
	);
}

// Review a past attempt
function viewPastAttempt(attempt: TestAttempt) {
	reviewingAttempt = attempt;
	isReviewingSubmission = true;
	isExamActive = false;
}

// Exit Review Mode
function exitReviewMode() {
	reviewingAttempt = null;
	isReviewingSubmission = false;
	isExamActive = false;
}

// Helper: Format Seconds into clean time
function formatDurationText(totalSeconds: number): string {
	return formatSecondsToText(totalSeconds);
}

// Timing Analysis for Review Mode
const attemptTimingStats = $derived.by(() => {
	if (!reviewingAttempt) return null;

	let fastestSecs = Infinity;
	let slowestSecs = -Infinity;
	let fastestQNumber = 1;
	let slowestQNumber = 1;
	let totalTimeTracked = 0;

	for (const q of testQuestions) {
		const resp = reviewingAttempt.responses[q.id];
		const time = resp?.timeSpentSeconds || 0;
		totalTimeTracked += time;

		if (time > 0 && time < fastestSecs) {
			fastestSecs = time;
			fastestQNumber = q.questionNumber;
		}
		if (time > slowestSecs) {
			slowestSecs = time;
			slowestQNumber = q.questionNumber;
		}
	}

	const avgSecs = testQuestions.length > 0 ? Math.round(totalTimeTracked / testQuestions.length) : 0;

	return {
		avgSecs,
		fastestSecs: fastestSecs === Infinity ? 0 : fastestSecs,
		fastestQNumber,
		slowestSecs: slowestSecs === -Infinity ? 0 : slowestSecs,
		slowestQNumber,
	};
});

// Scorecard Review Filter & Sort State
let reviewStatusFilter = $state<'all' | 'correct' | 'partial' | 'incorrect' | 'unattempted' | 'marked'>('all');
let reviewTypeFilter = $state<'all' | 'single_choice' | 'multi_choice' | 'numerical'>('all');
let reviewSortBy = $state<'question_asc' | 'question_desc' | 'time_desc' | 'time_asc' | 'marks_desc' | 'marks_asc'>('question_asc');
let reviewSearchQuery = $state<string>('');

interface EnrichedReviewQuestion {
	q: QuestionPreview;
	originalIndex: number;
	resp?: UserQuestionResponse;
	isCorrect: boolean;
	isPartiallyCorrect: boolean;
	isIncorrect: boolean;
	isUnattempted: boolean;
	isMarked: boolean;
	marksAwarded: number;
	timeSpentSeconds: number;
}

const enrichedReviewQuestions = $derived.by<EnrichedReviewQuestion[]>(() => {
	if (!reviewingAttempt) return [];

	return testQuestions.map((q, idx) => {
		const resp = reviewingAttempt?.responses[q.id];
		const hasAttempted = hasResponseAnswer(resp);
		const isCorrect = Boolean(resp?.isCorrect);
		const isPartiallyCorrect = Boolean(resp?.isPartiallyCorrect);
		const isIncorrect = hasAttempted && !isCorrect && !isPartiallyCorrect;
		const isUnattempted = !hasAttempted;
		const isMarked = Boolean(resp?.isMarkedForReview);
		const marksAwarded = resp?.marksAwarded ?? 0;
		const timeSpentSeconds = resp?.timeSpentSeconds ?? 0;

		return {
			q,
			originalIndex: idx,
			resp,
			isCorrect,
			isPartiallyCorrect,
			isIncorrect,
			isUnattempted,
			isMarked,
			marksAwarded,
			timeSpentSeconds,
		};
	});
});

const reviewFilterCounts = $derived.by(() => {
	let correct = 0;
	let partial = 0;
	let incorrect = 0;
	let unattempted = 0;
	let marked = 0;
	let singleChoice = 0;
	let multiChoice = 0;
	let numerical = 0;

	for (const item of enrichedReviewQuestions) {
		if (item.isCorrect) correct++;
		if (item.isPartiallyCorrect) partial++;
		if (item.isIncorrect) incorrect++;
		if (item.isUnattempted) unattempted++;
		if (item.isMarked) marked++;

		if (item.q.type === 'multi_choice' || item.q.type === 'multiple_choice_multi') {
			multiChoice++;
		} else if (item.q.type === 'single_choice' || item.q.type === 'multiple_choice') {
			singleChoice++;
		} else if (item.q.type === 'numerical') {
			numerical++;
		}
	}

	return {
		total: enrichedReviewQuestions.length,
		correct,
		partial,
		incorrect,
		unattempted,
		marked,
		singleChoice,
		multiChoice,
		numerical,
	};
});

const hasActiveReviewFilters = $derived(
	reviewStatusFilter !== 'all' ||
	reviewTypeFilter !== 'all' ||
	reviewSortBy !== 'question_asc' ||
	reviewSearchQuery.trim().length > 0
);

const displayedReviewQuestions = $derived.by(() => {
	let list = [...enrichedReviewQuestions];

	// Filter by Result Status
	if (reviewStatusFilter === 'correct') {
		list = list.filter((item) => item.isCorrect);
	} else if (reviewStatusFilter === 'partial') {
		list = list.filter((item) => item.isPartiallyCorrect);
	} else if (reviewStatusFilter === 'incorrect') {
		list = list.filter((item) => item.isIncorrect);
	} else if (reviewStatusFilter === 'unattempted') {
		list = list.filter((item) => item.isUnattempted);
	} else if (reviewStatusFilter === 'marked') {
		list = list.filter((item) => item.isMarked);
	}

	// Filter by Question Type
	if (reviewTypeFilter === 'single_choice') {
		list = list.filter((item) => item.q.type === 'single_choice' || item.q.type === 'multiple_choice');
	} else if (reviewTypeFilter === 'multi_choice') {
		list = list.filter((item) => item.q.type === 'multi_choice' || item.q.type === 'multiple_choice_multi');
	} else if (reviewTypeFilter === 'numerical') {
		list = list.filter((item) => item.q.type === 'numerical');
	}

	// Filter by Search Query
	if (reviewSearchQuery.trim()) {
		const query = reviewSearchQuery.toLowerCase().trim();
		list = list.filter((item) => {
			const textMatch = item.q.text.toLowerCase().includes(query);
			const numMatch =
				`question ${item.originalIndex + 1}`.includes(query) ||
				`q${item.originalIndex + 1}`.includes(query) ||
				`#${item.originalIndex + 1}`.includes(query);
			const explMatch = item.q.explanation?.toLowerCase().includes(query);
			const optMatch = item.q.options?.some((o) =>
				(typeof o === 'string' ? o : o.text).toLowerCase().includes(query)
			);
			return textMatch || numMatch || explMatch || optMatch;
		});
	}

	// Sorting
	list.sort((a, b) => {
		switch (reviewSortBy) {
			case 'question_desc':
				return b.originalIndex - a.originalIndex;
			case 'time_desc':
				return b.timeSpentSeconds - a.timeSpentSeconds;
			case 'time_asc':
				return a.timeSpentSeconds - b.timeSpentSeconds;
			case 'marks_desc':
				return b.marksAwarded - a.marksAwarded;
			case 'marks_asc':
				return a.marksAwarded - b.marksAwarded;
			default:
				return a.originalIndex - b.originalIndex;
		}
	});

	return list;
});

function resetReviewFilters() {
	reviewStatusFilter = 'all';
	reviewTypeFilter = 'all';
	reviewSortBy = 'question_asc';
	reviewSearchQuery = '';
}

// Lifecycle
onMount(() => {
	if (shouldStartImmediately && test && testQuestions.length > 0) {
		startSession(initialModeParam === 'practice' ? 'practice' : 'exam');
	}
});

onDestroy(() => {
	if (timerInterval) clearInterval(timerInterval);
});

// Keyboard navigation
function handleKeyDown(e: KeyboardEvent) {
	if (!isExamActive || isSubmitConfirmModalOpen || zoomedImage) return;

	if (e.key === 'ArrowRight' && !['input', 'textarea'].includes((e.target as HTMLElement)?.tagName.toLowerCase())) {
		handleNextQuestion();
	} else if (e.key === 'ArrowLeft' && !['input', 'textarea'].includes((e.target as HTMLElement)?.tagName.toLowerCase())) {
		handlePreviousQuestion();
	}
}

const pageTitle = $derived(
	test
		? isExamActive
			? `[${activeTestMode === 'practice' ? 'PRACTICE' : 'EXAM'}] ${test.title} — Testify`
			: `${test.title} — Testify`
		: 'Assessment Not Found — Testify'
);
</script>

<svelte:window onkeydown={handleKeyDown} />

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

{#if !test}
	<!-- Test Not Found -->
	<div class="mx-auto max-w-4xl px-4 py-16 text-center animate-fade-in">
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
	<!-- ================================================================= -->
	<!-- MODE 2: ACTIVE TESTING ENVIRONMENT (PRACTICE OR EXAM SIMULATION) -->
	<!-- ================================================================= -->
	<div class="min-h-screen bg-canvas flex flex-col">
		<!-- Top Fixed Sticky Header -->
		<header class="sticky top-0 z-30 bg-surface border-b-2 border-border-color shadow-sm px-4 sm:px-6 py-3">
			<div class="max-w-7xl mx-auto flex items-center justify-between gap-4">
				<!-- Title & Mode Badge -->
				<div class="flex items-center gap-2.5 truncate">
					{#if activeTestMode === 'practice'}
						<span class="neo-badge bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50 shrink-0 text-[10px] font-bold">
							🌿 Practice Mode
						</span>
					{:else}
						<span class="neo-badge bg-accent-contrast text-accent-contrast-text shrink-0 text-[10px] font-bold">
							🎯 Exam Simulation
						</span>
					{/if}
					<h1 class="text-sm sm:text-base font-black uppercase tracking-tight text-text-primary truncate" title={test.title}>
						{test.title}
					</h1>
				</div>

				<!-- Live Timer / Stopwatch & Submit -->
				<div class="flex items-center gap-3 shrink-0">
					<!-- Timer Box -->
					<div
						class={`flex items-center gap-2 px-3 py-1.5 border-2 font-mono font-black text-xs sm:text-sm transition-colors ${
							activeTestMode === 'practice'
								? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
								: isTimerUrgent
									? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500 animate-pulse'
									: isTimerWarning
										? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500'
										: 'bg-muted border-border-color text-text-primary'
						}`}
						title={activeTestMode === 'practice' ? 'Elapsed Practice Time (No Limit)' : 'Remaining Exam Time'}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="square"
							class="h-3.5 w-3.5"
						>
							<circle cx="12" cy="12" r="10" />
							<polyline points="12 6 12 12 16 14" />
						</svg>
						<span>{timerDisplay}</span>
						{#if activeTestMode === 'practice'}
							<span class="text-[9px] uppercase font-normal opacity-80">(Untimed)</span>
						{/if}
					</div>

					<!-- Progress Counter -->
					<span class="hidden sm:inline-flex font-mono text-xs font-bold text-text-muted">
						{examMetrics.answered}/{examMetrics.total} Done
					</span>

					<!-- Submit CTA -->
					<button
						type="button"
						onclick={() => (isSubmitConfirmModalOpen = true)}
						class="neo-btn neo-btn-primary text-xs py-1.5 px-3.5"
					>
						<span>{activeTestMode === 'practice' ? 'Finish Practice' : 'Submit Exam'}</span>
					</button>
				</div>
			</div>
		</header>

		<!-- Main Workspace Layout -->
		<div class="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
			<!-- LEFT COLUMN: Active Question Display (Col 8/12) -->
			<div class="lg:col-span-8 flex flex-col gap-4">
				{#if currentQuestion}
					<div class="neo-box p-5 sm:p-7 bg-surface space-y-6 animate-fade-in">
						<!-- Question Header Bar -->
						<div class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border-color/20 pb-3">
							<div class="flex items-center gap-2">
								<span class="text-base sm:text-lg font-black uppercase text-text-primary">
									Question {currentQuestionIndex + 1}
								</span>
								<span class="font-mono text-xs text-text-muted">
									of {testQuestions.length}
								</span>
								<!-- Current Question Time Badge -->
								{#if currentResponse?.timeSpentSeconds && currentResponse.timeSpentSeconds > 0}
									<span class="font-mono text-[11px] text-text-muted bg-muted px-2 py-0.5 border border-border-color/30">
										⏱️ {formatDurationText(currentResponse.timeSpentSeconds)}
									</span>
								{/if}
							</div>

							<div class="flex items-center gap-1.5">
								{#if currentQuestion.type === 'multi_choice' || currentQuestion.type === 'multiple_choice_multi'}
									<span class="neo-badge bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/40 text-[10px] uppercase font-bold">
										☑ Multi-Choice (Multi-Correct)
									</span>
								{:else if currentQuestion.type === 'single_choice' || currentQuestion.type === 'multiple_choice'}
									<span class="neo-badge bg-muted text-[10px] uppercase font-bold text-text-secondary">
										◉ Single Choice
									</span>
								{:else}
									<span class="neo-badge bg-muted text-[10px] uppercase font-bold text-text-secondary">
										# Numerical
									</span>
								{/if}

								<span class="neo-badge bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
									+{currentQuestion.marks} Marks
								</span>
								{#if currentQuestion.negativeMarks && currentQuestion.negativeMarks > 0 && activeTestMode === 'exam'}
									<span class="neo-badge bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/40 text-[10px] font-bold">
										-{currentQuestion.negativeMarks} Neg
									</span>
								{/if}
							</div>
						</div>

						<!-- Associated Diagram Figure -->
						{#if currentQuestion.associatedDiagramUrl}
							<div class="p-3 bg-muted/30 border-2 border-border-color inline-block max-w-full">
								<button
									type="button"
									onclick={() =>
										(zoomedImage = {
											title: `Question #${currentQuestion.questionNumber} - Figure`,
											src: currentQuestion.associatedDiagramUrl!,
											info: `Linked figure ${currentQuestion.associatedDiagramId || ''}`,
										})}
									class="cursor-pointer group flex flex-col items-start gap-1"
								>
									<img
										src={currentQuestion.associatedDiagramUrl}
										alt={`Figure for Question ${currentQuestion.questionNumber}`}
										class="max-h-56 max-w-full object-contain bg-white border border-border-color/30 group-hover:scale-[1.01] transition-transform"
									/>
									<span class="font-mono text-[10px] text-accent-contrast underline">
										🔍 Click diagram to enlarge
									</span>
								</button>
							</div>
						{/if}

						<!-- Question Statement (KaTeX + Markdown with preserved linebreaks) -->
						<div class="text-sm sm:text-base font-normal leading-relaxed text-text-primary">
							<MathRenderer content={currentQuestion.text} />
						</div>

						<!-- Practice Mode: Hint & Solution Helpers -->
						{#if activeTestMode === 'practice'}
							<div class="space-y-3 pt-1 border-t border-border-color/20">
								<div class="flex flex-wrap items-center gap-2">
									{#if currentQuestion.hint}
										<button
											type="button"
											onclick={() => (showHint = !showHint)}
											class={`neo-btn text-xs py-1.5 px-3 font-mono ${
												showHint
													? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500'
													: 'bg-surface hover:bg-muted text-text-secondary'
											}`}
										>
											💡 {showHint ? 'Hide Hint' : 'Show Hint'}
										</button>
									{/if}

									<button
										type="button"
										onclick={() => (showPracticeSolution = !showPracticeSolution)}
										class={`neo-btn text-xs py-1.5 px-3 font-mono ${
											showPracticeSolution
												? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500'
												: 'bg-surface hover:bg-muted text-text-secondary'
										}`}
									>
										👁️ {showPracticeSolution ? 'Hide Solution' : 'Check Solution'}
									</button>
								</div>

								<!-- Expandable Hint Card -->
								{#if showHint && currentQuestion.hint}
									<div class="p-3.5 bg-amber-500/10 border-2 border-amber-500/60 text-xs font-mono space-y-1 animate-slide-down">
										<span class="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
											💡 Practice Hint:
										</span>
										<div class="text-text-primary pl-4 border-l-2 border-amber-500/40">
											<MathRenderer content={currentQuestion.hint} />
										</div>
									</div>
								{/if}

								<!-- Expandable Practice Solution Card -->
								{#if showPracticeSolution}
									<div class="p-4 bg-indigo-500/10 border-2 border-indigo-500/60 text-xs font-mono space-y-2 animate-slide-down">
										<span class="font-bold text-indigo-700 dark:text-indigo-300 block">
											✓ Solution & Step-by-Step Explanation:
										</span>

										{#if currentQuestion.type === 'multi_choice' || currentQuestion.type === 'multiple_choice_multi'}
											{@const correctIds = currentQuestion.correctAnswers || (currentQuestion.correctAnswer ? [currentQuestion.correctAnswer] : [])}
											<div class="font-bold text-emerald-600 dark:text-emerald-400 space-y-1">
												<span>Correct Options ({correctIds.length}):</span>
												<div class="flex flex-wrap gap-1.5 pt-1">
													{#each correctIds as cId}
														{@const optObj = currentQuestion.options?.find((o) => o.id === cId)}
														<span class="px-2 py-0.5 border border-emerald-500/40 bg-emerald-500/10 text-xs">
															<MathRenderer content={optObj ? optObj.text : cId} inline={true} />
														</span>
													{/each}
												</div>
											</div>
										{:else if currentQuestion.correctAnswer}
											{@const matchingOpt = currentQuestion.options?.find((o) => o.id === currentQuestion.correctAnswer)}
											<div class="font-bold text-emerald-600 dark:text-emerald-400">
												Correct Answer: {matchingOpt ? matchingOpt.text : currentQuestion.correctAnswer}
											</div>
										{/if}

										{#if currentQuestion.explanation}
											<div class="text-text-primary pl-3 border-l-2 border-indigo-500/40 pt-1">
												<MathRenderer content={currentQuestion.explanation} />
											</div>
										{/if}
									</div>
								{/if}
							</div>
						{/if}

						<!-- Input / Options Section -->
						<div class="pt-2">
							{#if currentQuestion.type === 'single_choice' || currentQuestion.type === 'multi_choice' || currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'multiple_choice_multi'}
								{@const isMulti = currentQuestion.type === 'multi_choice' || currentQuestion.type === 'multiple_choice_multi'}
								<div class="space-y-3">
									{#if isMulti}
										<div class="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 p-2 border border-indigo-500/30 flex items-center gap-1.5">
											<span>☑</span>
											<span>Multiple options may be correct. Select all that apply.</span>
										</div>
									{/if}

									{#if currentQuestion.options && currentQuestion.options.length > 0}
										{#each currentQuestion.options as opt, optIdx}
											{@const optText = typeof opt === 'string' ? opt : opt.text}
											{@const optId = typeof opt === 'string' ? opt : opt.id}
											{@const isSelected = isMulti
												? (currentResponse?.selectedOptionIds || []).includes(optId)
												: currentResponse?.selectedOptionId === optId}
											{@const letter = String.fromCharCode(65 + optIdx)}

											<button
												type="button"
												onclick={() => (isMulti ? handleToggleMultiOption(optId) : handleSelectSingleOption(optId))}
												class={`w-full p-3.5 sm:p-4 text-left border-2 flex items-start gap-3.5 transition-all cursor-pointer ${
													isSelected
														? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[3px_3px_0px_var(--shadow-color)] -translate-y-0.5'
														: 'bg-surface hover:bg-muted/50 border-border-color'
												}`}
											>
												<span
													class={`flex h-7 w-7 shrink-0 items-center justify-center font-mono text-xs font-bold border-2 ${
														isSelected
															? 'bg-accent-contrast-text text-accent-contrast border-accent-contrast-text'
															: 'bg-muted border-border-color text-text-primary'
													}`}
												>
													{isMulti ? (isSelected ? '✓' : letter) : letter}
												</span>
												<div class="flex-1 text-xs sm:text-sm pt-0.5 overflow-x-auto">
													<MathRenderer content={optText} inline={true} />
												</div>
											</button>
										{/each}
									{:else}
										<div class="p-4 border-2 border-dashed border-border-color text-center text-xs font-mono text-text-muted">
											No options provided for this question.
										</div>
									{/if}
								</div>
							{:else}
								<!-- Numerical Answer Input -->
								<div class="max-w-md space-y-2">
									<label for="num-input" class="block font-mono text-xs font-bold uppercase text-text-muted">
										Enter Numerical Answer:
									</label>
									<div class="flex items-center gap-2">
										<input
											id="num-input"
											type="text"
											value={currentResponse?.numericalAnswer || ''}
											oninput={(e) => handleNumericalInput(e.currentTarget.value)}
											placeholder="e.g. 45.0"
											class="neo-input flex-1 font-mono text-base"
										/>
										{#if currentResponse?.numericalAnswer}
											<button
												type="button"
												onclick={handleClearResponse}
												class="neo-btn text-xs py-2 px-3"
												title="Clear answer"
											>
												✕
											</button>
										{/if}
									</div>
								</div>
							{/if}
						</div>

						<!-- Action Toolbar -->
						<div class="flex flex-wrap items-center justify-between gap-3 pt-6 border-t-2 border-border-color/20">
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={handlePreviousQuestion}
									disabled={currentQuestionIndex === 0}
									class="neo-btn text-xs py-2 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
								>
									&larr; Previous
								</button>
								<button
									type="button"
									onclick={handleClearResponse}
									disabled={!hasResponseAnswer(currentResponse)}
									class="neo-btn text-xs py-2 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
								>
									Clear
								</button>
							</div>

							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={handleMarkAndNext}
									class={`neo-btn text-xs py-2 px-3.5 ${
										currentResponse?.isMarkedForReview
											? 'bg-purple-600 text-white border-purple-700'
											: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/40'
									}`}
								>
									{currentResponse?.isMarkedForReview ? '★ Marked for Review' : '☆ Mark & Next'}
								</button>
								<button
									type="button"
									onclick={handleNextQuestion}
									class="neo-btn neo-btn-primary text-xs py-2 px-4"
								>
									<span>{currentQuestionIndex === testQuestions.length - 1 ? 'Save & Review' : 'Save & Next →'}</span>
								</button>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- RIGHT COLUMN: At-A-Glance Question Palette & Filter Drawer (Col 4/12) -->
			<div class="lg:col-span-4 space-y-4">
				<div class="neo-box p-5 bg-surface space-y-4">
					<!-- At-A-Glance Status Filter Pills -->
					<div class="space-y-2 border-b-2 border-border-color/20 pb-3">
						<span class="font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted block">
							At-A-Glance Question Status
						</span>
						<div class="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
							<button
								type="button"
								onclick={() => (paletteFilter = 'all')}
								class={`p-2 border text-left transition-colors flex items-center justify-between cursor-pointer ${
									paletteFilter === 'all'
										? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast font-bold'
										: 'bg-surface hover:bg-muted text-text-secondary border-border-color/40'
								}`}
							>
								<span>All Qs</span>
								<span class="font-bold">{testQuestions.length}</span>
							</button>

							<button
								type="button"
								onclick={() => (paletteFilter = 'attempted')}
								class={`p-2 border text-left transition-colors flex items-center justify-between cursor-pointer ${
									paletteFilter === 'attempted'
										? 'bg-emerald-600 text-white border-emerald-800 font-bold'
										: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
								}`}
							>
								<span>Attempted</span>
								<span class="font-bold">{examMetrics.answered}</span>
							</button>

							<button
								type="button"
								onclick={() => (paletteFilter = 'unattempted')}
								class={`p-2 border text-left transition-colors flex items-center justify-between cursor-pointer ${
									paletteFilter === 'unattempted'
										? 'bg-rose-600 text-white border-rose-800 font-bold'
										: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
								}`}
							>
								<span>Unattempted</span>
								<span class="font-bold">{examMetrics.unanswered}</span>
							</button>

							<button
								type="button"
								onclick={() => (paletteFilter = 'marked')}
								class={`p-2 border text-left transition-colors flex items-center justify-between cursor-pointer ${
									paletteFilter === 'marked'
										? 'bg-purple-600 text-white border-purple-800 font-bold'
										: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
								}`}
							>
								<span>Marked</span>
								<span class="font-bold">{examMetrics.marked}</span>
							</button>
						</div>
					</div>

					<!-- Palette Grid -->
					<div class="space-y-2">
						<div class="flex items-center justify-between font-mono text-[10px] text-text-muted">
							<span>Jump to Question</span>
							<span>Showing {filteredQuestionIndices.length} of {testQuestions.length}</span>
						</div>

						<div class="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
							{#each testQuestions as q, idx}
								{@const isVisible = filteredQuestionIndices.includes(idx)}
								{@const resp = userResponses[q.id]}
								{@const hasAnswer = hasResponseAnswer(resp)}
								{@const isMarked = resp?.isMarkedForReview}
								{@const isCurrent = idx === currentQuestionIndex}
								{@const isVisited = resp?.visited}

								{@const badgeColorClass = hasAnswer && isMarked
									? 'bg-indigo-600 text-white border-indigo-800'
									: isMarked
										? 'bg-purple-600 text-white border-purple-800'
										: hasAnswer
											? 'bg-emerald-600 text-white border-emerald-800'
											: isVisited
												? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500'
												: 'bg-surface text-text-muted border-border-color/60'}

								{#if isVisible}
									<button
										type="button"
										onclick={() => goToQuestion(idx)}
										class={`h-9 text-xs font-mono font-bold border-2 flex items-center justify-center transition-all cursor-pointer ${badgeColorClass} ${
											isCurrent ? 'ring-2 ring-accent-contrast ring-offset-2 scale-105 shadow-sm' : 'hover:scale-102'
										}`}
										title={`Question ${idx + 1} (${hasAnswer ? 'Attempted' : 'Unattempted'})`}
									>
										{idx + 1}
									</button>
								{/if}
							{/each}
						</div>
					</div>

					<!-- Palette Submit Button -->
					<button
						type="button"
						onclick={() => (isSubmitConfirmModalOpen = true)}
						class="neo-btn neo-btn-primary w-full text-xs py-2.5 mt-2"
					>
						{activeTestMode === 'practice' ? 'Complete Practice Session' : 'Final Exam Submission'}
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Submission Confirmation Modal with At-A-Glance Breakdown -->
	{#if isSubmitConfirmModalOpen}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fade-in"
			role="dialog"
			aria-modal="true"
		>
			<div class="neo-box-lg w-full max-w-lg bg-surface p-6 sm:p-7 space-y-5 animate-slide-down">
				<div class="border-b-2 border-border-color pb-3">
					<div class="flex items-center gap-2 mb-1">
						{#if activeTestMode === 'practice'}
							<span class="neo-badge bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px]">
								🌿 Practice Mode
							</span>
						{:else}
							<span class="neo-badge bg-accent-contrast text-accent-contrast-text text-[10px]">
								🎯 Exam Simulation
							</span>
						{/if}
					</div>
					<h3 class="text-xl font-black uppercase tracking-tight text-text-primary">
						{activeTestMode === 'practice' ? 'End Practice Session?' : 'Submit Examination?'}
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
							{examMetrics.answered}
						</span>
						<span class="text-[10px] text-text-muted">Questions</span>
					</div>
					<div class="p-2 bg-surface border border-border-color/40 flex flex-col">
						<span class="text-[10px] text-text-muted uppercase font-bold">Unattempted</span>
						<span class="text-xl font-black text-rose-500 my-0.5">
							{examMetrics.unanswered}
						</span>
						<span class="text-[10px] text-text-muted">Remaining</span>
					</div>
					<div class="p-2 bg-surface border border-border-color/40 flex flex-col">
						<span class="text-[10px] text-text-muted uppercase font-bold">Marked</span>
						<span class="text-xl font-black text-purple-600 dark:text-purple-400 my-0.5">
							{examMetrics.marked}
						</span>
						<span class="text-[10px] text-text-muted">For Review</span>
					</div>
				</div>

				{#if examMetrics.unanswered > 0}
					<div class="p-3 bg-amber-500/10 border-2 border-amber-500/50 text-xs font-mono text-amber-700 dark:text-amber-300">
						⚠️ You have {examMetrics.unanswered} unattempted questions that will receive 0 marks.
					</div>
				{/if}

				<div class="flex items-center justify-end gap-2 pt-3 border-t-2 border-border-color">
					<button
						type="button"
						onclick={() => (isSubmitConfirmModalOpen = false)}
						class="neo-btn text-xs py-2 px-4"
					>
						Return to Questions
					</button>
					<button
						type="button"
						onclick={submitExam}
						class="neo-btn neo-btn-primary text-xs py-2 px-5"
					>
						Confirm & Submit
					</button>
				</div>
			</div>
		</div>
	{/if}

{:else if isReviewingSubmission && reviewingAttempt}
	<!-- ================================================================= -->
	<!-- MODE 3: POST-SUBMISSION RESULTS, DETAILED SOLUTIONS & ANALYTICS -->
	<!-- ================================================================= -->
	<div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-8 animate-fade-in">
		<!-- Header Actions -->
		<div class="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border-color pb-4">
			<div>
				<div class="flex items-center gap-2 mb-1">
					{#if reviewingAttempt.mode === 'practice'}
						<span class="neo-badge bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50 text-[10px]">
							🌿 Practice Session Scorecard
						</span>
					{:else}
						<span class="neo-badge bg-accent-contrast text-accent-contrast-text text-[10px]">
							🎯 Exam Simulation Scorecard
						</span>
					{/if}
				</div>
				<h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-text-primary">
					{test.title}
				</h1>
			</div>

			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={exitReviewMode}
					class="neo-btn text-xs py-2 px-4"
				>
					&larr; Overview
				</button>
				<button
					type="button"
					onclick={() => startSession(reviewingAttempt?.mode || 'exam')}
					class="neo-btn neo-btn-primary text-xs py-2 px-4"
				>
					Retake ({reviewingAttempt?.mode === 'practice' ? 'Practice' : 'Exam'})
				</button>
			</div>
		</div>

		<!-- Scorecard Hero Box -->
		<div class="neo-box p-6 sm:p-8 bg-surface space-y-6">
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono">
				<div class="p-4 bg-muted/40 border-2 border-border-color flex flex-col justify-center">
					<span class="text-[10px] text-text-muted uppercase font-bold">Total Score</span>
					<span class="text-2xl sm:text-4xl font-black text-text-primary my-1">
						{reviewingAttempt.score} <span class="text-sm font-normal text-text-muted">/ {reviewingAttempt.maxPossibleScore}</span>
					</span>
					<span class="text-[11px] font-bold text-accent-contrast">
						{Math.round((reviewingAttempt.score / (reviewingAttempt.maxPossibleScore || 1)) * 100)}% Gained
					</span>
				</div>

				<div class="p-4 bg-muted/40 border-2 border-border-color flex flex-col justify-center">
					<span class="text-[10px] text-text-muted uppercase font-bold">Accuracy</span>
					<span class="text-2xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 my-1">
						{reviewingAttempt.accuracyPercentage}%
					</span>
					<span class="text-[11px] text-text-muted">
						{reviewingAttempt.correctCount} of {reviewingAttempt.answeredCount} Correct
					</span>
				</div>

				<div class="p-4 bg-muted/40 border-2 border-border-color flex flex-col justify-center">
					<span class="text-[10px] text-text-muted uppercase font-bold">Total Duration</span>
					<span class="text-2xl sm:text-4xl font-black text-text-primary my-1">
						{formatDurationText(reviewingAttempt.durationSecondsTaken)}
					</span>
					<span class="text-[11px] text-text-muted">
						{reviewingAttempt.mode === 'practice' ? 'Practice Session' : `Limit: ${test.durationMinutes || 60}m`}
					</span>
				</div>

				<div class="p-4 bg-muted/40 border-2 border-border-color flex flex-col justify-center">
					<span class="text-[10px] text-text-muted uppercase font-bold">Questions</span>
					<div class="flex items-center justify-center gap-1.5 my-1 font-black text-base sm:text-lg">
						<span class="text-emerald-600 dark:text-emerald-400" title="Correct">+{reviewingAttempt.correctCount}</span>
						<span>/</span>
						<span class="text-rose-500" title="Incorrect">-{reviewingAttempt.incorrectCount}</span>
						<span>/</span>
						<span class="text-text-muted" title="Unattempted">○{reviewingAttempt.unattemptedCount}</span>
					</div>
					<span class="text-[11px] text-text-muted">
						{reviewingAttempt.totalQuestions} Questions
					</span>
				</div>
			</div>

			<!-- Per-Question Timing Analytics Panel -->
			{#if attemptTimingStats}
				<div class="p-4 bg-muted/30 border-2 border-border-color/60 space-y-2 font-mono text-xs">
					<div class="flex items-center justify-between border-b border-border-color/30 pb-2">
						<span class="font-bold text-text-primary flex items-center gap-1.5">
							⏱️ Time-Per-Question Breakdown
						</span>
						<span class="text-text-muted">
							Average: ~{formatDurationText(attemptTimingStats.avgSecs)} / question
						</span>
					</div>
					<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 text-[11px]">
						<div>
							<span class="text-text-muted block">Avg Time / Question:</span>
							<span class="font-bold text-text-primary">{formatDurationText(attemptTimingStats.avgSecs)}</span>
						</div>
						<div>
							<span class="text-text-muted block">Fastest Question:</span>
							<span class="font-bold text-emerald-600 dark:text-emerald-400">
								Q#{attemptTimingStats.fastestQNumber} ({formatDurationText(attemptTimingStats.fastestSecs)})
							</span>
						</div>
						<div>
							<span class="text-text-muted block">Longest Question:</span>
							<span class="font-bold text-amber-600 dark:text-amber-400">
								Q#{attemptTimingStats.slowestQNumber} ({formatDurationText(attemptTimingStats.slowestSecs)})
							</span>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Question-by-Question Detailed Solutions Breakdown with Sorting & Filtering -->
		<div class="space-y-5">
			<!-- Section Header & Sort Controls -->
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-border-color pb-3">
				<div>
					<h2 class="text-lg sm:text-xl font-black uppercase tracking-tight text-text-primary">
						Step-by-Step Solutions & Breakdown
					</h2>
					<p class="text-xs text-text-muted font-mono mt-0.5">
						Showing {displayedReviewQuestions.length} of {testQuestions.length} questions
						{#if hasActiveReviewFilters}
							<span class="text-accent-contrast font-bold">• Active Filters Applied</span>
						{/if}
					</p>
				</div>

				<!-- Sort Dropdown -->
				<div class="flex items-center gap-2">
					<label for="review-sort" class="font-mono text-xs font-bold text-text-muted shrink-0">
						Sort:
					</label>
					<select
						id="review-sort"
						bind:value={reviewSortBy}
						class="neo-input py-1.5 px-2.5 font-mono text-xs cursor-pointer bg-surface"
					>
						<option value="question_asc">Question # (1 → N)</option>
						<option value="question_desc">Question # (N → 1)</option>
						<option value="time_desc">⏱️ Time Spent: Longest First</option>
						<option value="time_asc">⏱️ Time Spent: Shortest First</option>
						<option value="marks_desc">📈 Marks Awarded: High to Low</option>
						<option value="marks_asc">📉 Marks Awarded: Low to High</option>
					</select>
				</div>
			</div>

			<!-- Comprehensive Filter Controls Box -->
			<div class="neo-box-sm p-4 bg-surface space-y-3 font-mono text-xs">
				<!-- Row 1: Search & Reset -->
				<div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
					<!-- Search Input -->
					<div class="relative flex-1">
						<input
							type="text"
							bind:value={reviewSearchQuery}
							placeholder="🔍 Search question statement, formula, options, or explanation..."
							class="neo-input w-full pl-3 pr-8 py-1.5 text-xs font-mono"
						/>
						{#if reviewSearchQuery}
							<button
								type="button"
								onclick={() => (reviewSearchQuery = '')}
								class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs cursor-pointer"
								title="Clear search"
							>
								✕
							</button>
						{/if}
					</div>

					{#if hasActiveReviewFilters}
						<button
							type="button"
							onclick={resetReviewFilters}
							class="neo-btn text-xs py-1.5 px-3 font-mono font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-rose-500/40 shrink-0 cursor-pointer"
						>
							✕ Reset All Filters
						</button>
					{/if}
				</div>

				<!-- Row 2: Status Filter Buttons -->
				<div class="space-y-1.5 pt-1.5 border-t border-border-color/20">
					<span class="text-[10px] text-text-muted uppercase font-bold tracking-wider block">
						Filter by Status:
					</span>
					<div class="flex flex-wrap items-center gap-1.5 text-[11px]">
						<button
							type="button"
							onclick={() => (reviewStatusFilter = 'all')}
							class={`px-2.5 py-1 border transition-colors cursor-pointer ${
								reviewStatusFilter === 'all'
									? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast font-bold'
									: 'bg-muted/40 hover:bg-muted text-text-secondary border-border-color/40'
							}`}
						>
							All ({reviewFilterCounts.total})
						</button>

						<button
							type="button"
							onclick={() => (reviewStatusFilter = 'correct')}
							class={`px-2.5 py-1 border transition-colors cursor-pointer ${
								reviewStatusFilter === 'correct'
									? 'bg-emerald-600 text-white border-emerald-800 font-bold'
									: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
							}`}
						>
							✓ Correct ({reviewFilterCounts.correct})
						</button>

						{#if reviewFilterCounts.partial > 0}
							<button
								type="button"
								onclick={() => (reviewStatusFilter = 'partial')}
								class={`px-2.5 py-1 border transition-colors cursor-pointer ${
									reviewStatusFilter === 'partial'
										? 'bg-amber-600 text-white border-amber-800 font-bold'
										: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
								}`}
							>
								⚡ Partially Correct ({reviewFilterCounts.partial})
							</button>
						{/if}

						<button
							type="button"
							onclick={() => (reviewStatusFilter = 'incorrect')}
							class={`px-2.5 py-1 border transition-colors cursor-pointer ${
								reviewStatusFilter === 'incorrect'
									? 'bg-rose-600 text-white border-rose-800 font-bold'
									: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
							}`}
						>
							✗ Incorrect ({reviewFilterCounts.incorrect})
						</button>

						<button
							type="button"
							onclick={() => (reviewStatusFilter = 'unattempted')}
							class={`px-2.5 py-1 border transition-colors cursor-pointer ${
								reviewStatusFilter === 'unattempted'
									? 'bg-neutral-700 text-white border-neutral-900 font-bold'
									: 'bg-muted text-text-muted border-border-color/40 hover:bg-muted/80'
							}`}
						>
							○ Unattempted ({reviewFilterCounts.unattempted})
						</button>

						{#if reviewFilterCounts.marked > 0}
							<button
								type="button"
								onclick={() => (reviewStatusFilter = 'marked')}
								class={`px-2.5 py-1 border transition-colors cursor-pointer ${
									reviewStatusFilter === 'marked'
										? 'bg-purple-600 text-white border-purple-800 font-bold'
										: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/20'
								}`}
							>
								★ Marked ({reviewFilterCounts.marked})
							</button>
						{/if}
					</div>
				</div>

				<!-- Row 3: Question Type Filter Buttons -->
				<div class="space-y-1.5 pt-1.5 border-t border-border-color/20">
					<span class="text-[10px] text-text-muted uppercase font-bold tracking-wider block">
						Filter by Question Type:
					</span>
					<div class="flex flex-wrap items-center gap-1.5 text-[11px]">
						<button
							type="button"
							onclick={() => (reviewTypeFilter = 'all')}
							class={`px-2.5 py-1 border transition-colors cursor-pointer ${
								reviewTypeFilter === 'all'
									? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast font-bold'
									: 'bg-muted/40 hover:bg-muted text-text-secondary border-border-color/40'
							}`}
						>
							All Types ({reviewFilterCounts.total})
						</button>

						{#if reviewFilterCounts.singleChoice > 0}
							<button
								type="button"
								onclick={() => (reviewTypeFilter = 'single_choice')}
								class={`px-2.5 py-1 border transition-colors cursor-pointer ${
									reviewTypeFilter === 'single_choice'
										? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast font-bold'
										: 'bg-muted/40 hover:bg-muted text-text-secondary border-border-color/40'
								}`}
							>
								◉ Single Choice (SCMCQ) ({reviewFilterCounts.singleChoice})
							</button>
						{/if}

						{#if reviewFilterCounts.multiChoice > 0}
							<button
								type="button"
								onclick={() => (reviewTypeFilter = 'multi_choice')}
								class={`px-2.5 py-1 border transition-colors cursor-pointer ${
									reviewTypeFilter === 'multi_choice'
										? 'bg-indigo-600 text-white border-indigo-800 font-bold'
										: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20'
								}`}
							>
								☑ Multi-Correct (MCMCQ) ({reviewFilterCounts.multiChoice})
							</button>
						{/if}

						{#if reviewFilterCounts.numerical > 0}
							<button
								type="button"
								onclick={() => (reviewTypeFilter = 'numerical')}
								class={`px-2.5 py-1 border transition-colors cursor-pointer ${
									reviewTypeFilter === 'numerical'
										? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast font-bold'
										: 'bg-muted/40 hover:bg-muted text-text-secondary border-border-color/40'
								}`}
							>
								# Numerical ({reviewFilterCounts.numerical})
							</button>
						{/if}
					</div>
				</div>
			</div>

			<!-- Question Cards List -->
			{#if displayedReviewQuestions.length > 0}
				<div class="space-y-4">
					{#each displayedReviewQuestions as item (item.q.id)}
						{@const q = item.q}
						{@const idx = item.originalIndex}
						{@const resp = item.resp}
						{@const isCorrect = item.isCorrect}
						{@const isPartiallyCorrect = item.isPartiallyCorrect}
						{@const hasAttempted = hasResponseAnswer(resp)}
						{@const timeSpent = item.timeSpentSeconds}
						{@const isMulti = q.type === 'multi_choice' || q.type === 'multiple_choice_multi'}

						<div class="neo-box-sm p-5 bg-surface space-y-4">
							<!-- Question Card Header -->
							<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border-color/30 pb-2.5">
								<div class="flex items-center gap-2">
									<span class="font-mono text-sm font-bold text-text-primary">
										Question #{idx + 1}
									</span>
									<span class="neo-badge bg-muted text-[10px] uppercase font-bold text-text-secondary">
										{#if isMulti}
											☑ Multi-Choice (Multi-Correct)
										{:else if q.type === 'single_choice' || q.type === 'multiple_choice'}
											◉ Single Choice
										{:else}
											# Numerical
										{/if}
									</span>
									{#if timeSpent > 0}
										<span class="font-mono text-[11px] text-text-muted bg-muted px-2 py-0.5 border border-border-color/30">
											⏱️ Time: {formatDurationText(timeSpent)}
										</span>
									{/if}
								</div>

								<div class="flex items-center gap-2">
									{#if isCorrect}
										<span class="neo-badge bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 text-[10px] font-bold">
											✓ Correct (+{resp?.marksAwarded} Pts)
										</span>
									{:else if isPartiallyCorrect}
										<span class="neo-badge bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 text-[10px] font-bold">
											⚡ Partially Correct (+{resp?.marksAwarded} Pts)
										</span>
									{:else if hasAttempted}
										<span class="neo-badge bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/40 text-[10px] font-bold">
											✗ Incorrect ({resp?.marksAwarded || 0} Pts)
										</span>
									{:else}
										<span class="neo-badge bg-muted text-text-muted border-border-color/40 text-[10px]">
											○ Unattempted (0 Pts)
										</span>
									{/if}
								</div>
							</div>

							<!-- Diagram -->
							{#if q.associatedDiagramUrl}
								<div class="p-2.5 bg-muted/30 border border-border-color/60 inline-block">
									<button
										type="button"
										onclick={() =>
											(zoomedImage = {
												title: `Question #${idx + 1} - Diagram`,
												src: q.associatedDiagramUrl!,
												info: `Figure ${q.associatedDiagramId || ''}`,
											})}
										class="cursor-pointer group flex flex-col items-start gap-1"
									>
										<img
											src={q.associatedDiagramUrl}
											alt={`Diagram for question ${idx + 1}`}
											class="max-h-40 max-w-full object-contain border border-border-color/30 group-hover:scale-[1.02] transition-transform"
										/>
										<span class="font-mono text-[10px] text-accent-contrast underline">
											🔍 Enlarge Diagram
										</span>
									</button>
								</div>
							{/if}

							<!-- Question Statement -->
							<div class="text-sm font-normal text-text-primary leading-relaxed">
								<MathRenderer content={q.text} />
							</div>

							<!-- Options & User Answer Review -->
							{#if q.type === 'single_choice' || q.type === 'multi_choice' || q.type === 'multiple_choice' || q.type === 'multiple_choice_multi'}
								{@const correctIds = q.correctAnswers || (q.correctAnswer ? [q.correctAnswer] : [])}
								{@const userSelectedIds = resp?.selectedOptionIds || (resp?.selectedOptionId ? [resp.selectedOptionId] : [])}

								<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
									{#each q.options || [] as opt, optIdx}
										{@const optText = typeof opt === 'string' ? opt : opt.text}
										{@const optId = typeof opt === 'string' ? opt : opt.id}
										{@const isUserSelected = userSelectedIds.includes(optId)}
										{@const isActualCorrect = correctIds.includes(optId)}
										{@const letter = String.fromCharCode(65 + optIdx)}

										<div
											class={`p-3 border-2 text-xs font-mono flex items-start gap-2.5 ${
												isActualCorrect
													? 'bg-emerald-500/15 border-emerald-500 text-text-primary font-bold'
													: isUserSelected
														? 'bg-rose-500/15 border-rose-500 text-text-primary'
														: 'bg-muted/30 border-border-color/30 text-text-secondary'
											}`}
										>
											<span class="flex h-5 w-5 shrink-0 items-center justify-center font-bold border border-current">
												{letter}
											</span>
											<div class="flex-1 overflow-x-auto pt-0.5">
												<MathRenderer content={optText} inline={true} />
											</div>
											{#if isActualCorrect && isUserSelected}
												<span class="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
													✓ Correct Selection
												</span>
											{:else if isActualCorrect}
												<span class="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
													✓ Correct Option
												</span>
											{:else if isUserSelected}
												<span class="text-rose-500 font-bold shrink-0">
													✗ Your Selection
												</span>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<!-- Numerical Review -->
								<div class="p-3 bg-muted/40 border-2 border-border-color text-xs font-mono space-y-1">
									<div class="flex items-center gap-2">
										<span class="text-text-muted">Your Answer:</span>
										<span class="font-bold {isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}">
											{resp?.numericalAnswer || 'None'}
										</span>
									</div>
									<div class="flex items-center gap-2">
										<span class="text-text-muted">Correct Solution:</span>
										<span class="font-bold text-emerald-600 dark:text-emerald-400">
											{q.correctAnswer}
										</span>
									</div>
								</div>
							{/if}

							<!-- Hint (if available) -->
							{#if q.hint}
								<div class="p-2.5 bg-amber-500/10 border-l-2 border-amber-500 text-xs font-mono space-y-1">
									<span class="font-bold text-amber-700 dark:text-amber-300 block">💡 Hint:</span>
									<MathRenderer content={q.hint} />
								</div>
							{/if}

							<!-- Detailed Step-by-Step Explanation -->
							{#if q.explanation}
								<div class="p-3.5 bg-muted/40 border-l-2 border-accent-contrast text-xs font-mono space-y-1.5">
									<span class="font-bold text-accent-contrast block">
										📝 Step-by-Step Solution & Explanation:
									</span>
									<MathRenderer content={q.explanation} />
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<!-- Empty Filter Results Card -->
				<div class="neo-box p-8 text-center bg-surface space-y-3 font-mono text-xs">
					<div class="mx-auto flex h-12 w-12 items-center justify-center border-2 border-border-color bg-muted">
						<span class="text-xl">🔍</span>
					</div>
					<p class="font-bold text-text-primary text-sm uppercase">No Questions Match Current Filters</p>
					<p class="text-text-muted max-w-sm mx-auto">
						There are no questions matching your status, type, or search keyword selection.
					</p>
					<div class="pt-1">
						<button
							type="button"
							onclick={resetReviewFilters}
							class="neo-btn neo-btn-primary text-xs py-2 px-4 cursor-pointer"
						>
							Reset All Filters
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>

{:else}
	<!-- ================================================================= -->
	<!-- MODE 1: TEST OVERVIEW & DUAL MODE LAUNCHER (DEFAULT) -->
	<!-- ================================================================= -->
	<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8 animate-fade-in">
		<!-- Back to Dashboard Link -->
		<div>
			<a
				href="/"
				class="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase text-text-muted hover:text-text-primary transition-colors"
			>
				<span>&larr; Back to Assessments Dashboard</span>
			</a>
		</div>

		<!-- Exam Hero Section -->
		<div class="neo-box p-6 sm:p-8 bg-surface space-y-6">
			<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
				<div class="space-y-2">
					<div class="flex flex-wrap items-center gap-2">
						<span class="neo-badge bg-accent-contrast text-accent-contrast-text">
							{test.subject}
						</span>
						{#if test.hasAnswerKey}
							<span class="neo-badge bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
								🔑 Answer Key Active
							</span>
						{:else}
							<span class="neo-badge bg-muted text-text-muted border border-border-color/40 text-[10px]">
								🚫 No Answer Key
							</span>
						{/if}
						{#if allDiagrams.length > 0}
							<span class="neo-badge bg-amber-500/20 text-amber-600 dark:text-amber-400">
								🎨 {allDiagrams.length} Diagrams
							</span>
						{/if}
						<span class="font-mono text-xs text-text-muted">
							Uploaded {formatDate(test.createdAt)}
						</span>
					</div>

					<h1 class="text-2xl sm:text-4xl font-black uppercase tracking-tight text-text-primary">
						{test.title}
					</h1>

					{#if test.description}
						<p class="text-sm text-text-secondary max-w-3xl">
							{test.description}
						</p>
					{/if}
				</div>

				<!-- Dual Mode Launcher Cards -->
				<div class="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
					<!-- Practice Mode Button -->
					<button
						type="button"
						onclick={() => startSession('practice')}
						class="neo-btn text-xs py-3 px-5 text-left flex items-center justify-between gap-4 border-emerald-600 dark:border-emerald-500 hover:bg-emerald-500/10 cursor-pointer"
					>
						<div class="flex items-center gap-2.5">
							<span class="text-lg">🌿</span>
							<div>
								<p class="font-black text-emerald-700 dark:text-emerald-300 uppercase">Practice Mode</p>
								<p class="font-mono text-[10px] text-text-muted normal-case">Untimed • Hints & Solutions</p>
							</div>
						</div>
						<span class="font-mono font-bold text-emerald-600">&rarr;</span>
					</button>

					<!-- Exam Simulation Button -->
					<button
						type="button"
						onclick={() => startSession('exam')}
						class="neo-btn neo-btn-primary text-xs py-3 px-5 text-left flex items-center justify-between gap-4 cursor-pointer"
					>
						<div class="flex items-center gap-2.5">
							<span class="text-lg">🎯</span>
							<div>
								<p class="font-black uppercase">Exam Simulation</p>
								<p class="font-mono text-[10px] opacity-85 normal-case">Timed ({test.durationMinutes || 60}m) • Strict CBT</p>
							</div>
						</div>
						<span class="font-mono font-bold">&rarr;</span>
					</button>
				</div>
			</div>

			<!-- Specs Grid -->
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/40 border-2 border-border-color font-mono text-xs">
				<div>
					<span class="text-[10px] text-text-muted uppercase block font-bold">Exam Duration</span>
					<span class="text-base font-black text-text-primary">
						{test.durationMinutes ? `${test.durationMinutes} Minutes` : 'Untimed'}
					</span>
				</div>
				<div>
					<span class="text-[10px] text-text-muted uppercase block font-bold">Total Questions</span>
					<span class="text-base font-black text-text-primary">
						{test.questionCount} Questions
					</span>
				</div>
				<div>
					<span class="text-[10px] text-text-muted uppercase block font-bold">Total Marks</span>
					<span class="text-base font-black text-text-primary">
						{test.totalMarks} Points
					</span>
				</div>
				<div>
					<span class="text-[10px] text-text-muted uppercase block font-bold">PDF Source</span>
					<span class="text-xs font-bold text-text-primary truncate block" title={test.testFileName}>
						{test.testFileName}
					</span>
				</div>
			</div>
		</div>

		<!-- Performance & Attempt Analytics Dashboard -->
		{#if testStats && testStats.attemptCount > 0}
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
				<div class="neo-box p-4 bg-surface text-center">
					<span class="text-[10px] text-text-muted uppercase font-bold block">Total Sessions</span>
					<span class="text-2xl font-black text-text-primary my-1 block">{testStats.attemptCount}</span>
					<span class="text-[10px] text-text-muted">
						🎯 {testStats.examAttemptCount} Exam • 🌿 {testStats.practiceAttemptCount} Practice
					</span>
				</div>
				<div class="neo-box p-4 bg-surface text-center">
					<span class="text-[10px] text-text-muted uppercase font-bold block">Best Exam Score</span>
					<span class="text-2xl font-black text-emerald-600 dark:text-emerald-400 my-1 block">
						{testStats.bestExamScore} <span class="text-xs font-normal text-text-muted">/ {testStats.maxPossibleScore}</span>
					</span>
					<span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
						{testStats.maxPossibleScore > 0 ? Math.round((testStats.bestExamScore / testStats.maxPossibleScore) * 100) : 0}% Exam Best
					</span>
				</div>
				<div class="neo-box p-4 bg-surface text-center">
					<span class="text-[10px] text-text-muted uppercase font-bold block">Best Practice Score</span>
					<span class="text-2xl font-black text-accent-contrast my-1 block">
						{testStats.bestPracticeScore} <span class="text-xs font-normal text-text-muted">/ {testStats.maxPossibleScore}</span>
					</span>
					<span class="text-[10px] text-text-muted">
						{testStats.maxPossibleScore > 0 ? Math.round((testStats.bestPracticeScore / testStats.maxPossibleScore) * 100) : 0}% Practice Best
					</span>
				</div>
				<div class="neo-box p-4 bg-surface text-center">
					<span class="text-[10px] text-text-muted uppercase font-bold block">Last Attempt</span>
					<span class="text-xs font-bold text-text-primary my-2 block truncate">
						{testStats.lastAttemptAt ? formatDate(testStats.lastAttemptAt) : 'N/A'}
					</span>
					<button
						type="button"
						onclick={() => testStats.latestAttempt && viewPastAttempt(testStats.latestAttempt)}
						class="text-[10px] font-bold text-accent-contrast underline cursor-pointer"
					>
						Review Latest &rarr;
					</button>
				</div>
			</div>
		{/if}

		<!-- Tabs Section -->
		<div class="space-y-4">
			<!-- Tab Navigation Bar -->
			<div class="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border-color pb-3">
				<div class="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onclick={() => (activeOverviewTab = 'attempts')}
						class={`neo-btn text-xs py-2 px-4 font-mono font-bold ${
							activeOverviewTab === 'attempts' ? 'neo-btn-primary' : 'bg-surface'
						}`}
					>
						Past Attempts ({app.attempts.getAttemptsForTest(test.id, 'all').length})
					</button>
					<button
						type="button"
						onclick={() => (activeOverviewTab = 'questions')}
						class={`neo-btn text-xs py-2 px-4 font-mono font-bold ${
							activeOverviewTab === 'questions' ? 'neo-btn-primary' : 'bg-surface'
						}`}
					>
						Questions & Structure ({testQuestions.length})
					</button>
					<button
						type="button"
						onclick={() => (activeOverviewTab = 'diagrams')}
						class={`neo-btn text-xs py-2 px-4 font-mono font-bold ${
							activeOverviewTab === 'diagrams' ? 'neo-btn-primary' : 'bg-surface'
						}`}
					>
						Extracted Diagrams ({allDiagrams.length})
					</button>
					<button
						type="button"
						onclick={() => (activeOverviewTab = 'pages')}
						class={`neo-btn text-xs py-2 px-4 font-mono font-bold ${
							activeOverviewTab === 'pages' ? 'neo-btn-primary' : 'bg-surface'
						}`}
					>
						PDF Pages ({allPages.length})
					</button>
				</div>

				<!-- Attempt Filter Sub-tabs (when on attempts tab) -->
				{#if activeOverviewTab === 'attempts'}
					<div class="inline-flex items-center border border-border-color bg-surface overflow-hidden font-mono text-[10px]">
						<button
							type="button"
							onclick={() => (attemptHistoryFilter = 'all')}
							class={`px-2.5 py-1 transition-colors cursor-pointer ${
								attemptHistoryFilter === 'all' ? 'bg-accent-contrast text-accent-contrast-text font-bold' : 'hover:bg-muted text-text-muted'
							}`}
						>
							All ({app.attempts.getAttemptsForTest(test.id, 'all').length})
						</button>
						<button
							type="button"
							onclick={() => (attemptHistoryFilter = 'exam')}
							class={`px-2.5 py-1 border-x border-border-color transition-colors cursor-pointer ${
								attemptHistoryFilter === 'exam' ? 'bg-accent-contrast text-accent-contrast-text font-bold' : 'hover:bg-muted text-text-muted'
							}`}
						>
							🎯 Exam ({app.attempts.getAttemptsForTest(test.id, 'exam').length})
						</button>
						<button
							type="button"
							onclick={() => (attemptHistoryFilter = 'practice')}
							class={`px-2.5 py-1 transition-colors cursor-pointer ${
								attemptHistoryFilter === 'practice' ? 'bg-accent-contrast text-accent-contrast-text font-bold' : 'hover:bg-muted text-text-muted'
							}`}
						>
							🌿 Practice ({app.attempts.getAttemptsForTest(test.id, 'practice').length})
						</button>
					</div>
				{/if}
			</div>

			<!-- TAB 1: Past Attempts -->
			{#if activeOverviewTab === 'attempts'}
				{#if testAttempts.length > 0}
					<div class="space-y-3">
						{#each testAttempts as attempt, attIdx}
							<div class="neo-box-sm p-4 sm:p-5 bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4">
								<div class="space-y-1 font-mono text-xs">
									<div class="flex items-center gap-2">
										<span class="font-bold text-sm text-text-primary">
											Attempt #{testAttempts.length - attIdx}
										</span>
										{#if attempt.mode === 'practice'}
											<span class="neo-badge bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 text-[10px] font-bold">
												🌿 Practice
											</span>
										{:else}
											<span class="neo-badge bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40 text-[10px] font-bold">
												🎯 Exam Sim
											</span>
										{/if}
										<span class="neo-badge bg-muted text-[10px] font-bold">
											Score: {attempt.score} / {attempt.maxPossibleScore} ({Math.round((attempt.score / (attempt.maxPossibleScore || 1)) * 100)}%)
										</span>
									</div>
									<div class="text-[11px] text-text-muted flex items-center gap-3 pt-0.5">
										<span>📅 {formatDate(attempt.startedAt)}</span>
										<span>⏱️ {formatDurationText(attempt.durationSecondsTaken)}</span>
										<span>🎯 {attempt.accuracyPercentage}% Accuracy</span>
									</div>
								</div>

								<div class="flex items-center gap-2">
									<button
										type="button"
										onclick={() => viewPastAttempt(attempt)}
										class="neo-btn neo-btn-primary text-xs py-1.5 px-3 flex-1 sm:flex-none"
									>
										View Scorecard & Review
									</button>
									<button
										type="button"
										onclick={() => app.attempts.deleteAttempt(attempt.id)}
										class="neo-btn text-xs py-1.5 px-2.5 text-rose-500 hover:bg-rose-600 hover:text-white"
										title="Delete this attempt"
									>
										✕
									</button>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="neo-box p-8 sm:p-12 text-center bg-surface space-y-3">
						<div class="mx-auto flex h-12 w-12 items-center justify-center border-2 border-border-color bg-muted">
							<span class="text-xl font-mono">📝</span>
						</div>
						<h3 class="font-mono text-base font-bold uppercase text-text-primary">
							No Attempts Recorded Yet
						</h3>
						<p class="text-xs text-text-secondary max-w-sm mx-auto">
							Take your first exam or practice session to track your performance, per-question timing, and detailed solutions.
						</p>
						<div class="flex flex-wrap items-center justify-center gap-2 pt-2">
							<button
								type="button"
								onclick={() => startSession('practice')}
								class="neo-btn text-xs py-2 px-4 border-emerald-600 text-emerald-700 dark:text-emerald-300"
							>
								🌿 Start Practice
							</button>
							<button
								type="button"
								onclick={() => startSession('exam')}
								class="neo-btn neo-btn-primary text-xs py-2 px-4"
							>
								🎯 Start Exam Simulation
							</button>
						</div>
					</div>
				{/if}
			{/if}

			<!-- TAB 2: Questions & Structure Breakdown -->
			{#if activeOverviewTab === 'questions'}
				<div class="space-y-3">
					{#each testQuestions as q}
						<div class="neo-box-sm p-4 sm:p-5 bg-surface text-sm space-y-3">
							<div class="flex items-center justify-between font-mono text-xs">
								<span class="font-bold text-text-primary">Question #{q.questionNumber}</span>
								<span class="text-[11px] text-text-muted uppercase font-bold">
									{#if q.type === 'multi_choice' || q.type === 'multiple_choice_multi'}
										[Multi-Choice (Multi-Correct)] • {q.marks} Marks
									{:else if q.type === 'single_choice' || q.type === 'multiple_choice'}
										[Single Choice] • {q.marks} Marks
									{:else}
										[Numerical] • {q.marks} Marks
									{/if}
								</span>
							</div>

							{#if q.associatedDiagramUrl}
								<div class="p-2 bg-muted/30 border border-border-color/60 inline-block">
									<button
										type="button"
										onclick={() =>
											(zoomedImage = {
												title: `Question #${q.questionNumber} - Associated Diagram`,
												src: q.associatedDiagramUrl!,
												info: `Linked figure ${q.associatedDiagramId || ''}`,
											})}
										class="cursor-pointer group flex flex-col items-start gap-1"
									>
										<img
											src={q.associatedDiagramUrl}
											alt={`Figure for question ${q.questionNumber}`}
											class="max-h-36 max-w-full object-contain border border-border-color/30 group-hover:scale-[1.02] transition-transform"
										/>
										<span class="font-mono text-[10px] text-accent-contrast underline">
											🔍 Click to enlarge diagram
										</span>
									</button>
								</div>
							{/if}

							<div class="text-xs text-text-secondary">
								<MathRenderer content={q.text} />
							</div>

							{#if q.options && q.options.length > 0}
								<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
									{#each q.options as opt, optIdx}
										{@const optText = typeof opt === 'string' ? opt : opt.text}
										<div class="p-2 bg-muted/60 border border-border-color/30 text-xs font-mono flex items-start gap-2">
											<span class="font-bold text-accent-contrast shrink-0">
												{String.fromCharCode(65 + optIdx)})
											</span>
											<div class="flex-1 overflow-x-auto">
												<MathRenderer content={optText} inline={true} />
											</div>
										</div>
									{/each}
								</div>
							{/if}

							{#if q.hint}
								<div class="p-2 bg-amber-500/10 border-l-2 border-amber-500 text-[11px] font-mono">
									<span class="font-bold text-amber-700 dark:text-amber-300">💡 Hint:</span>
									<MathRenderer content={q.hint} />
								</div>
							{/if}

							{#if test.hasAnswerKey}
								<div class="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold pt-1 flex items-center gap-1.5 flex-wrap">
									<span>✓ Solution:</span>
									{#if q.type === 'multi_choice' || q.type === 'multiple_choice_multi'}
										{@const correctList = q.correctAnswers || (q.correctAnswer ? [q.correctAnswer] : [])}
										{#each correctList as cId}
											{@const matchingOpt = q.options?.find((o) => o.id === cId)}
											<span class="bg-emerald-500/10 px-1.5 py-0.5 border border-emerald-500/30">
												<MathRenderer content={matchingOpt ? matchingOpt.text : cId} inline={true} />
											</span>
										{/each}
									{:else if q.type === 'single_choice' || q.type === 'multiple_choice'}
										{@const matchingOpt = q.options?.find((o) => (typeof o === 'object' ? o.id === q.correctAnswer : o === q.correctAnswer))}
										<span class="bg-emerald-500/10 px-1.5 py-0.5 border border-emerald-500/30">
											<MathRenderer content={matchingOpt ? (typeof matchingOpt === 'string' ? matchingOpt : matchingOpt.text) : (q.correctAnswer || '')} inline={true} />
										</span>
									{:else if q.correctAnswer}
										<span class="bg-emerald-500/10 px-1.5 py-0.5 border border-emerald-500/30">
											<MathRenderer content={q.correctAnswer} inline={true} />
										</span>
									{/if}
								</div>
							{/if}

							{#if q.explanation}
								<div class="p-2.5 bg-muted/40 border-l-2 border-accent-contrast text-[11px] font-mono mt-1 space-y-1">
									<span class="font-bold text-accent-contrast block">Step-by-Step Explanation:</span>
									<MathRenderer content={q.explanation} />
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<!-- TAB 3: Extracted Diagrams -->
			{#if activeOverviewTab === 'diagrams'}
				<div>
					{#if allDiagrams.length > 0}
						<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
							{#each allDiagrams as diag}
								<div
									class="neo-box-sm p-2 bg-surface flex flex-col justify-between group cursor-pointer hover:border-accent-contrast transition-colors"
									onclick={() =>
										(zoomedImage = {
											title: `Page ${diag.pageNumber} - Figure #${diag.imageIndex}`,
											src: diag.dataUrl,
											info: `${diag.width} × ${diag.height} px • ${formatBytes(diag.sizeBytes)}`,
										})}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && (zoomedImage = {
										title: `Page ${diag.pageNumber} - Figure #${diag.imageIndex}`,
										src: diag.dataUrl,
										info: `${diag.width} × ${diag.height} px • ${formatBytes(diag.sizeBytes)}`,
									})}
								>
									<div class="aspect-square bg-white border border-border-color/40 flex items-center justify-center p-1.5 overflow-hidden">
										<img
											src={diag.dataUrl}
											alt={`Diagram #${diag.imageIndex}`}
											class="max-h-full max-w-full object-contain"
											loading="lazy"
										/>
									</div>
									<div class="mt-2 font-mono text-[10px] space-y-0.5">
										<div class="flex items-center justify-between font-bold text-text-primary">
											<span>P.{diag.pageNumber} #{diag.imageIndex}</span>
											<span class="uppercase text-[9px] px-1 py-0.2 border bg-indigo-500/10 text-indigo-500 border-indigo-500/30">
												{diag.type === 'vector_diagram' ? 'Vector' : 'Raster'}
											</span>
										</div>
										<p class="text-text-muted truncate">{diag.width}×{diag.height} px</p>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="neo-box p-8 border-dashed text-center font-mono text-xs text-text-muted space-y-1">
							<p class="font-bold text-text-primary">No Extracted Diagrams Found</p>
							<p>This exam contains text and formula elements without embedded figure diagrams.</p>
						</div>
					{/if}
				</div>
			{/if}

			<!-- TAB 4: Original PDF Pages -->
			{#if activeOverviewTab === 'pages'}
				<div>
					{#if allPages.length > 0}
						<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
							{#each allPages as pg}
								<div
									class="neo-box-sm p-2.5 bg-surface flex flex-col justify-between group cursor-pointer hover:border-accent-contrast transition-colors"
									onclick={() =>
										(zoomedImage = {
											title: `Page ${pg.pageNumber} of ${allPages.length}`,
											src: pg.rasterDataUrl,
											info: `${pg.rasterWidth} × ${pg.rasterHeight} px • ${formatBytes(pg.rasterSizeBytes)}`,
										})}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && (zoomedImage = {
										title: `Page ${pg.pageNumber} of ${allPages.length}`,
										src: pg.rasterDataUrl,
										info: `${pg.rasterWidth} × ${pg.rasterHeight} px`,
									})}
								>
									<div class="aspect-[3/4] bg-white border border-border-color/40 flex items-center justify-center p-1 overflow-hidden">
										<img
											src={pg.rasterDataUrl}
											alt={`Page ${pg.pageNumber}`}
											class="max-h-full max-w-full object-contain"
											loading="lazy"
										/>
									</div>
									<div class="mt-2 font-mono text-xs flex items-center justify-between">
										<span class="font-bold text-text-primary">Page {pg.pageNumber}</span>
										<span class="text-[10px] text-text-muted">{pg.embeddedImages.length} figures</span>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="neo-box p-8 border-dashed text-center font-mono text-xs text-text-muted">
							Full page renders will be available when a test is extracted.
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Shared Zoom Lightbox Modal -->
<ImageLightboxModal
	image={zoomedImage}
	onclose={() => (zoomedImage = null)}
/>
