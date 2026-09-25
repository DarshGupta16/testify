import { db, type TestifyDatabase } from '$lib/services/db';
import type { AppStore } from '$lib/stores/appContext.svelte';

export interface StorageStats {
	testsCount: number;
	attemptsCount: number;
	foldersCount: number;
	offlineOpsCount: number;
	estimatedStorageMb: string;
}

/**
 * Retrieves storage telemetry metrics across IndexedDB tables (tests, attempts, folders, offline ops)
 * and estimates total browser quota usage.
 */
export async function getStorageStats(customDb: TestifyDatabase = db): Promise<StorageStats> {
	try {
		const [tests, attempts, folders, ops] = await Promise.all([
			customDb.getAllTests(),
			customDb.getAllAttempts(),
			customDb.getAllFolders(),
			customDb.offlineOps.count(),
		]);

		let storageMb = '0.00';
		if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
			const est = await navigator.storage.estimate();
			if (est.usage) {
				storageMb = (est.usage / (1024 * 1024)).toFixed(2);
			}
		}

		return {
			testsCount: tests.length,
			attemptsCount: attempts.length,
			foldersCount: folders.length,
			offlineOpsCount: ops,
			estimatedStorageMb: storageMb,
		};
	} catch (err) {
		console.error('[storageTelemetry] Failed calculating storage telemetry:', err);
		return {
			testsCount: 0,
			attemptsCount: 0,
			foldersCount: 0,
			offlineOpsCount: 0,
			estimatedStorageMb: '0.00',
		};
	}
}

/**
 * Clears cached PDF page background scans from Dexie table and in-memory cache,
 * freeing up significant storage without affecting tests, questions, diagrams, or scores.
 */
export async function clearDocumentAssetsCache(
	app: AppStore,
	customDb: TestifyDatabase = db
): Promise<void> {
	await customDb.testDocAssets.clear();
	app.tests.docAssetsCache.clear();
}
