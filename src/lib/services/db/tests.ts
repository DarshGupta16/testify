import type { PaperBlueprint } from '$lib/types/blueprint';
import type { TestItem } from '$lib/types/test';
import { toCloneable } from '$lib/utils/snapshot.svelte';
import type { TestifyDatabase } from './database';

export async function getAllTests(db: TestifyDatabase): Promise<TestItem[]> {
	try {
		return await db.tests.toArray();
	} catch (err) {
		console.error('[DB] Failed to get all tests:', err);
		return [];
	}
}

export async function getTestById(db: TestifyDatabase, id: string): Promise<TestItem | undefined> {
	try {
		return await db.tests.get(id);
	} catch (err) {
		console.error(`[DB] Failed to get test by id "${id}":`, err);
		return undefined;
	}
}

export async function saveTest(db: TestifyDatabase, test: TestItem): Promise<void> {
	const record = {
		...test,
		updatedAt: test.updatedAt || new Date().toISOString(),
	};
	await db.tests.put(toCloneable(record));
}

export async function updateTest(
	db: TestifyDatabase,
	id: string,
	updates: Partial<TestItem>
): Promise<void> {
	await db.tests.update(
		id,
		toCloneable({
			...updates,
			updatedAt: updates.updatedAt || new Date().toISOString(),
		})
	);
}

export async function updateTestBlueprint(
	db: TestifyDatabase,
	id: string,
	blueprint: PaperBlueprint
): Promise<void> {
	await db.tests.update(id, {
		blueprint: toCloneable(blueprint),
		updatedAt: new Date().toISOString(),
	});
}

export async function bulkSaveTests(db: TestifyDatabase, testsList: TestItem[]): Promise<void> {
	const now = new Date().toISOString();
	const stamped = testsList.map((t) => ({
		...t,
		updatedAt: t.updatedAt || now,
	}));
	await db.tests.bulkPut(toCloneable(stamped));
}

export async function deleteTest(db: TestifyDatabase, id: string): Promise<void> {
	await atomicCascadeDeleteTests(db, [id]);
}

export async function clearAllTests(db: TestifyDatabase): Promise<void> {
	await db.transaction('rw', [db.tests, db.attempts, db.testDocAssets, db.devTraces], async () => {
		await db.tests.clear();
		await db.attempts.clear();
		await db.testDocAssets.clear();
		await db.devTraces.clear();
	});
}

export async function bulkUpdateTestFolder(
	db: TestifyDatabase,
	testIds: string[],
	folderId: string | null
): Promise<void> {
	if (testIds.length === 0) return;
	const now = new Date().toISOString();
	await db.transaction('rw', db.tests, async () => {
		for (const id of testIds) {
			await db.tests.update(id, { folderId, updatedAt: now });
		}
	});
}

export async function atomicCascadeDeleteTests(
	db: TestifyDatabase,
	testIds: string[]
): Promise<void> {
	if (testIds.length === 0) return;
	await db.transaction('rw', [db.tests, db.attempts, db.testDocAssets, db.devTraces], async () => {
		await db.tests.bulkDelete(testIds);
		await db.attempts.where('testId').anyOf(testIds).delete();
		await db.testDocAssets.bulkDelete(testIds);
		await db.devTraces.where('testId').anyOf(testIds).delete();
	});
}
