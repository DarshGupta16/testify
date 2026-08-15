/**
 * Testify - User Examination Attempt State Management
 */

import { db, fireAndForget, type TestifyDatabase } from '$lib/services/db';
import type { TestAttempt } from '$lib/types/test';

export interface TestAttemptStats {
	attemptCount: number;
	examAttemptCount: number;
	practiceAttemptCount: number;
	bestScore: number;
	bestExamScore: number;
	bestPracticeScore: number;
	maxPossibleScore: number;
	bestPercentage: number;
	avgScore: number;
	avgPercentage: number;
	lastAttemptAt?: string;
	latestAttempt?: TestAttempt;
}

export class AttemptStore {
	private database: TestifyDatabase;

	attempts = $state<TestAttempt[]>([]);
	isLoading = $state<boolean>(false);

	constructor(customDb: TestifyDatabase = db) {
		this.database = customDb;
	}

	async init(): Promise<void> {
		this.isLoading = true;
		try {
			const saved = await this.database.getAllAttempts();
			this.attempts = saved || [];
		} catch (err) {
			console.error('[AttemptStore] Failed to initialize attempts:', err);
		} finally {
			this.isLoading = false;
		}
	}

	getAttemptsForTest(testId: string, filterMode: 'all' | 'exam' | 'practice' = 'all'): TestAttempt[] {
		return this.attempts
			.filter((a) => a.testId === testId && (filterMode === 'all' || a.mode === filterMode))
			.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
	}

	getStatsForTest(testId: string, testTotalMarks = 0): TestAttemptStats {
		const testAttempts = this.getAttemptsForTest(testId, 'all');
		if (testAttempts.length === 0) {
			return {
				attemptCount: 0,
				examAttemptCount: 0,
				practiceAttemptCount: 0,
				bestScore: 0,
				bestExamScore: 0,
				bestPracticeScore: 0,
				maxPossibleScore: testTotalMarks,
				bestPercentage: 0,
				avgScore: 0,
				avgPercentage: 0,
				lastAttemptAt: undefined,
				latestAttempt: undefined,
			};
		}

		let bestScore = -Infinity;
		let bestExamScore = 0;
		let bestPracticeScore = 0;
		let examCount = 0;
		let practiceCount = 0;
		let totalScore = 0;
		let maxPossibleScore = testTotalMarks;

		for (const a of testAttempts) {
			if (a.score > bestScore) {
				bestScore = a.score;
			}
			if (a.mode === 'exam') {
				examCount++;
				if (a.score > bestExamScore) bestExamScore = a.score;
			} else {
				practiceCount++;
				if (a.score > bestPracticeScore) bestPracticeScore = a.score;
			}

			totalScore += a.score;
			if (a.maxPossibleScore > maxPossibleScore) {
				maxPossibleScore = a.maxPossibleScore;
			}
		}

		if (bestScore === -Infinity) bestScore = 0;
		const avgScore = Math.round((totalScore / testAttempts.length) * 10) / 10;
		const bestPercentage = maxPossibleScore > 0 ? Math.round((Math.max(0, bestScore) / maxPossibleScore) * 100) : 0;
		const avgPercentage = maxPossibleScore > 0 ? Math.round((Math.max(0, avgScore) / maxPossibleScore) * 100) : 0;

		return {
			attemptCount: testAttempts.length,
			examAttemptCount: examCount,
			practiceAttemptCount: practiceCount,
			bestScore,
			bestExamScore,
			bestPracticeScore,
			maxPossibleScore,
			bestPercentage,
			avgScore,
			avgPercentage,
			lastAttemptAt: testAttempts[0]?.completedAt || testAttempts[0]?.startedAt,
			latestAttempt: testAttempts[0],
		};
	}

	recordAttempt(attempt: TestAttempt): void {
		// 1. In-memory update
		const existingIndex = this.attempts.findIndex((a) => a.id === attempt.id);
		if (existingIndex >= 0) {
			this.attempts[existingIndex] = attempt;
		} else {
			this.attempts = [attempt, ...this.attempts];
		}

		// 2. Fire-and-forget background DB write
		fireAndForget(
			this.database.saveAttempt(attempt),
			`Persisting Exam Attempt "${attempt.id}" to Dexie`
		);
	}

	deleteAttempt(id: string): void {
		this.attempts = this.attempts.filter((a) => a.id !== id);
		fireAndForget(
			this.database.deleteAttempt(id),
			`Deleting Exam Attempt "${id}" from Dexie`
		);
	}

	deleteAttemptsForTest(testId: string): void {
		this.attempts = this.attempts.filter((a) => a.testId !== testId);
		fireAndForget(
			this.database.deleteAttemptsByTestId(testId),
			`Deleting all attempts for test "${testId}" from Dexie`
		);
	}

	clearAll(): void {
		this.attempts = [];
		fireAndForget(
			this.database.clearAllAttempts(),
			'Clearing all attempts from Dexie'
		);
	}
}
