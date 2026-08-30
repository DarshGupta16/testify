import { dev } from '$app/environment';
import type { PaperBlueprint } from '$lib/types/blueprint';
import type { TestItem } from '$lib/types/test';
import { toCloneable } from '$lib/utils/snapshot.svelte';
import { deleteAttemptsByTestId } from './attempts';
import type { TestifyDatabase } from './database';
import { deleteDevTrace } from './devTraces';
import { deleteTestDocAssets } from './docAssets';

export async function getAllTests(db: TestifyDatabase): Promise<TestItem[]> {
	try {
		return await db.tests.toArray();
	} catch (err) {
		console.error('[DB] Failed to get all tests:', err);
		return [];
	}
}

export async function getTestById(
	db: TestifyDatabase,
	id: string
): Promise<TestItem | undefined> {
	try {
		return await db.tests.get(id);
	} catch (err) {
		console.error(`[DB] Failed to get test by id "${id}":`, err);
		return undefined;
	}
}

export async function saveTest(db: TestifyDatabase, test: TestItem): Promise<void> {
	await db.tests.put(toCloneable(test));
}

export async function saveSimilarPaperTest(
	db: TestifyDatabase,
	test: TestItem
): Promise<void> {
	await db.tests.put(toCloneable(test));
}

export async function updateTest(
	db: TestifyDatabase,
	id: string,
	updates: Partial<TestItem>
): Promise<void> {
	await db.tests.update(id, toCloneable(updates));
}

export async function updateTestBlueprint(
	db: TestifyDatabase,
	id: string,
	blueprint: PaperBlueprint
): Promise<void> {
	await db.tests.update(id, { blueprint: toCloneable(blueprint) });
}

export async function bulkSaveTests(db: TestifyDatabase, testsList: TestItem[]): Promise<void> {
	await db.tests.bulkPut(toCloneable(testsList));
}

export async function deleteTest(db: TestifyDatabase, id: string): Promise<void> {
	await db.tests.delete(id);
	// Cascade delete attempts for this test
	await deleteAttemptsByTestId(db, id);
	// Cascade delete heavy document assets for this test
	await deleteTestDocAssets(db, id);
	// Cascade delete dev pipeline trace if present
	if (dev) {
		await deleteDevTrace(db, id);
	}
}

export async function clearAllTests(db: TestifyDatabase): Promise<void> {
	await db.tests.clear();
	try {
		await db.testDocAssets.clear();
	} catch (err) {
		console.error('[DB] Failed to clear test document assets:', err);
	}
}
