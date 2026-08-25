import type { PdfExtractionResult } from '$lib/types/pdf';
import { toCloneable } from '$lib/utils/snapshot.svelte';
import type { TestifyDatabase } from './database';

export async function getTestDocAssets(
	db: TestifyDatabase,
	testId: string
): Promise<PdfExtractionResult | undefined> {
	try {
		const record = await db.testDocAssets.get(testId);
		return record ? record.extractedData : undefined;
	} catch (err) {
		console.error(`[DB] Failed to get test document assets for "${testId}":`, err);
		return undefined;
	}
}

export async function saveTestDocAssets(
	db: TestifyDatabase,
	testId: string,
	assets: PdfExtractionResult
): Promise<void> {
	await db.testDocAssets.put(
		toCloneable({
			testId,
			extractedData: assets,
		})
	);
}

export async function deleteTestDocAssets(db: TestifyDatabase, testId: string): Promise<void> {
	try {
		await db.testDocAssets.delete(testId);
	} catch (err) {
		console.error(`[DB] Failed to delete test document assets for "${testId}":`, err);
	}
}
