import type { FolderItem } from '$lib/types/folder';
import { toCloneable } from '$lib/utils/snapshot.svelte';
import type { TestifyDatabase } from './database';

export async function getAllFolders(db: TestifyDatabase): Promise<FolderItem[]> {
	try {
		return await db.folders.toArray();
	} catch (err) {
		console.error('[DB] Failed to get all folders:', err);
		return [];
	}
}

export async function getFolderById(
	db: TestifyDatabase,
	id: string
): Promise<FolderItem | undefined> {
	try {
		return await db.folders.get(id);
	} catch (err) {
		console.error(`[DB] Failed to get folder by id "${id}":`, err);
		return undefined;
	}
}

export async function saveFolder(db: TestifyDatabase, folder: FolderItem): Promise<void> {
	const record = {
		...folder,
		updatedAt: folder.updatedAt || new Date().toISOString(),
	};
	await db.folders.put(toCloneable(record));
}

export async function bulkSaveFolders(
	db: TestifyDatabase,
	foldersList: FolderItem[]
): Promise<void> {
	const now = new Date().toISOString();
	const stamped = foldersList.map((f) => ({
		...f,
		updatedAt: f.updatedAt || now,
	}));
	await db.folders.bulkPut(toCloneable(stamped));
}

export async function updateFolder(
	db: TestifyDatabase,
	id: string,
	updates: Partial<FolderItem>
): Promise<void> {
	await db.folders.update(
		id,
		toCloneable({
			...updates,
			updatedAt: updates.updatedAt || new Date().toISOString(),
		})
	);
}

export async function deleteFolder(db: TestifyDatabase, id: string): Promise<void> {
	await db.folders.delete(id);
}

export async function clearAllFolders(db: TestifyDatabase): Promise<void> {
	await db.folders.clear();
}

/**
 * Atomically cascades deletion of folders, contained tests, attempts,
 * extracted document assets, dev pipeline traces, and queued generation jobs.
 */
export async function atomicCascadeDeleteFolder(
	db: TestifyDatabase,
	folderIds: string[],
	testIds: string[],
	jobIds: string[] = []
): Promise<void> {
	await db.transaction(
		'rw',
		[db.folders, db.tests, db.attempts, db.testDocAssets, db.devTraces, db.generationJobs],
		async () => {
			if (folderIds.length > 0) {
				await db.folders.bulkDelete(folderIds);
			}
			if (testIds.length > 0) {
				await db.tests.bulkDelete(testIds);
				await db.attempts.where('testId').anyOf(testIds).delete();
				await db.testDocAssets.bulkDelete(testIds);
				await db.devTraces.where('testId').anyOf(testIds).delete();
			}
			if (jobIds.length > 0) {
				await db.generationJobs.bulkDelete(jobIds);
			}
		}
	);
}
