/**
 * Testify - Pure Assessment Evaluation & Scoring Domain Service
 *
 * Implements authoritative grading, multi-choice partial marking, numerical tolerance verification,
 * timing analytics, and reactive attempt state transformations.
 */

import type {
	QuestionPreview,
	TestAttempt,
	TestItem,
	TestMode,
	UserQuestionResponse,
} from '$lib/types/test';

/**
 * Pure function to determine whether a user response contains an active attempt.
 */
export function hasResponseAnswer(resp?: UserQuestionResponse): boolean {
	if (!resp) return false;
	if (resp.selectedOptionId) return true;
	if (resp.selectedOptionIds && resp.selectedOptionIds.length > 0) return true;
	if (resp.numericalAnswer && resp.numericalAnswer.trim().length > 0) return true;
	return false;
}

/**
 * Initializes a clean map of user responses with per-question time tracking and visited flags.
 */
export function createInitialResponses(
	questions: QuestionPreview[]
): Record<string, UserQuestionResponse> {
	const initial: Record<string, UserQuestionResponse> = {};
	for (const q of questions) {
		initial[q.id] = {
			questionId: q.id,
			visited: false,
			isMarkedForReview: false,
			timeSpentSeconds: 0,
			selectedOptionIds: [],
		};
	}
	if (questions[0]) {
		initial[questions[0].id].visited = true;
	}
	return initial;
}

export interface LiveExamMetrics {
	answered: number;
	unanswered: number;
	marked: number;
	notVisited: number;
	notAnswered: number;
	total: number;
}

/**
 * Computes live metrics for the exam runner palette.
 */
export function calculateExamMetrics(
	questions: QuestionPreview[],
	userResponses: Record<string, UserQuestionResponse>
): LiveExamMetrics {
	let answered = 0;
	let marked = 0;
	let notVisited = 0;
	let notAnswered = 0;

	for (const q of questions) {
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
		unanswered: questions.length - answered,
		marked,
		notVisited,
		notAnswered,
		total: questions.length,
	};
}

export interface EvaluationOptions {
	test: TestItem;
	userResponses: Record<string, UserQuestionResponse>;
	elapsedTimeSeconds: number;
	mode: TestMode;
	attemptId: string;
	examStartedAt: number;
}

/**
 * Evaluates an examination attempt with strict multi-correct partial marking,
 * single-choice negative marking, and numerical precision comparison.
 */
export function evaluateAttempt(options: EvaluationOptions): TestAttempt {
	const { test, userResponses, elapsedTimeSeconds, mode, attemptId, examStartedAt } = options;
	const questions = test.questions || [];

	let totalScore = 0;
	let maxPossibleScore = 0;
	let correctCount = 0;
	let incorrectCount = 0;
	let answeredCount = 0;
	let unattemptedCount = 0;
	let reviewCount = 0;

	const evaluatedResponses: Record<string, UserQuestionResponse> = {};

	for (const q of questions) {
		maxPossibleScore += q.marks;
		const resp = userResponses[q.id] || {
			questionId: q.id,
			visited: false,
			timeSpentSeconds: 0,
		};
		let isCorrect = false;
		let isPartiallyCorrect = false;
		let marksAwarded = 0;

		const hasAnswer = hasResponseAnswer(resp);

		if (hasAnswer) {
			answeredCount++;

			if (q.type === 'multi_choice' || q.type === 'multiple_choice_multi') {
				// Multi-choice multi-correct evaluation with partial marking
				const correctList: string[] =
					q.correctAnswers || (q.correctAnswer ? [q.correctAnswer] : []);
				const userList: string[] =
					resp.selectedOptionIds || (resp.selectedOptionId ? [resp.selectedOptionId] : []);

				if (userList.length === 0) {
					marksAwarded = 0;
					unattemptedCount++;
				} else {
					const hasIncorrectChoice = userList.some((id) => !correctList.includes(id));

					if (hasIncorrectChoice) {
						// Incorrect selection penalizes full negative marks
						isCorrect = false;
						isPartiallyCorrect = false;
						marksAwarded = -(q.negativeMarks || 0);
						incorrectCount++;
					} else {
						if (userList.length === correctList.length && correctList.length > 0) {
							// All correct options chosen: full marks awarded
							isCorrect = true;
							isPartiallyCorrect = false;
							marksAwarded = q.marks;
							correctCount++;
						} else if (correctList.length > 0) {
							// Partial marks awarded proportionally
							isCorrect = false;
							isPartiallyCorrect = true;
							marksAwarded =
								Math.round((userList.length / correctList.length) * q.marks * 100) / 100;
							correctCount++;
						}
					}
				}
			} else if (q.type === 'single_choice' || q.type === 'multiple_choice') {
				// Single-choice multiple choice question
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
				// Numerical comparison with decimal tolerance (0.01)
				const userNum = Number.parseFloat(resp.numericalAnswer || '');
				const correctNum = Number.parseFloat(q.correctAnswer || '');
				if (
					!Number.isNaN(userNum) &&
					!Number.isNaN(correctNum) &&
					Math.abs(userNum - correctNum) <= 0.01
				) {
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

	return {
		id: attemptId,
		testId: test.id,
		testTitle: test.title,
		startedAt: new Date(examStartedAt).toISOString(),
		completedAt: new Date().toISOString(),
		durationSecondsTaken: elapsedTimeSeconds,
		mode,
		status: 'completed',
		responses: evaluatedResponses,
		score: Math.max(0, Math.round(totalScore * 100) / 100),
		maxPossibleScore,
		accuracyPercentage,
		totalQuestions: questions.length,
		answeredCount,
		correctCount,
		incorrectCount,
		unattemptedCount,
		reviewCount,
	};
}

export interface AttemptTimingStats {
	avgSecs: number;
	fastestSecs: number;
	fastestQNumber: number;
	slowestSecs: number;
	slowestQNumber: number;
	totalTimeTracked: number;
}

/**
 * Calculates per-question timing speed metrics for performance analysis.
 */
export function calculateAttemptTimingStats(
	questions: QuestionPreview[],
	attempt: TestAttempt
): AttemptTimingStats {
	let fastestSecs = Infinity;
	let slowestSecs = -Infinity;
	let fastestQNumber = 1;
	let slowestQNumber = 1;
	let totalTimeTracked = 0;

	for (const q of questions) {
		const resp = attempt.responses[q.id];
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

	const avgSecs = questions.length > 0 ? Math.round(totalTimeTracked / questions.length) : 0;

	return {
		avgSecs,
		fastestSecs: fastestSecs === Infinity ? 0 : fastestSecs,
		fastestQNumber,
		slowestSecs: slowestSecs === -Infinity ? 0 : slowestSecs,
		slowestQNumber,
		totalTimeTracked,
	};
}

export interface EnrichedReviewQuestion {
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

/**
 * Enriches test questions with attempt evaluation metadata for clean review rendering.
 */
export function getEnrichedReviewQuestions(
	questions: QuestionPreview[],
	attempt: TestAttempt
): EnrichedReviewQuestion[] {
	return questions.map((q, idx) => {
		const resp = attempt.responses[q.id];
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
}
