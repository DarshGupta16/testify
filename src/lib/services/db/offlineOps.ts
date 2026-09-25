import type { TestifyDatabase } from './database';
import type { OfflineOp } from './types';

export async function getAllOfflineOps(db: TestifyDatabase): Promise<OfflineOp[]> {
	try {
		return await db.offlineOps.orderBy('timestamp').toArray();
	} catch (err) {
		console.error('[DB] Failed to get offline ops:', err);
		return [];
	}
}

export async function addOfflineOp(
	db: TestifyDatabase,
	op: Omit<OfflineOp, 'id' | 'timestamp'>
): Promise<number | undefined> {
	try {
		return await db.offlineOps.add({
			...op,
			timestamp: Date.now(),
		});
	} catch (err) {
		console.error('[DB] Failed to add offline op:', err);
		return undefined;
	}
}

export async function deleteOfflineOp(db: TestifyDatabase, id: number): Promise<void> {
	try {
		await db.offlineOps.delete(id);
	} catch (err) {
		console.error(`[DB] Failed to delete offline op with id "${id}":`, err);
	}
}

export async function clearAllOfflineOps(db: TestifyDatabase): Promise<void> {
	try {
		await db.offlineOps.clear();
	} catch (err) {
		console.error('[DB] Failed to clear offline ops:', err);
	}
}
