import type { TestAttempt } from '$lib/types/test';
import { toCloneable } from '$lib/utils/snapshot.svelte';
import type { TestifyDatabase } from './database';

export async function getAllAttempts(db: TestifyDatabase): Promise<TestAttempt[]> {
	try {
		return await db.attempts.toArray();
	} catch (err) {
		console.error('[DB] Failed to get all attempts:', err);
		return [];
	}
}

export async function getAttemptsByTestId(
	db: TestifyDatabase,
	testId: string
): Promise<TestAttempt[]> {
	try {
		return await db.attempts.where('testId').equals(testId).toArray();
	} catch (err) {
		console.error(`[DB] Failed to get attempts for test "${testId}":`, err);
		return [];
	}
}

export async function getAttempt(
	db: TestifyDatabase,
	id: string
): Promise<TestAttempt | undefined> {
	try {
		return await db.attempts.get(id);
	} catch (err) {
		console.error(`[DB] Failed to get attempt "${id}":`, err);
		return undefined;
	}
}

export async function saveAttempt(db: TestifyDatabase, attempt: TestAttempt): Promise<void> {
	await db.attempts.put(toCloneable(attempt));
}

export async function deleteAttempt(db: TestifyDatabase, id: string): Promise<void> {
	await db.attempts.delete(id);
}

export async function deleteAttemptsByTestId(db: TestifyDatabase, testId: string): Promise<void> {
	try {
		await db.attempts.where('testId').equals(testId).delete();
	} catch (err) {
		console.error(`[DB] Failed to delete attempts for test "${testId}":`, err);
	}
}

export async function clearAllAttempts(db: TestifyDatabase): Promise<void> {
	await db.attempts.clear();
}
