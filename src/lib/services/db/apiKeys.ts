import type { AIProvider, StoredApiKeyRecord } from '$lib/types/apiKeys';
import { toCloneable } from '$lib/utils/snapshot.svelte';
import type { TestifyDatabase } from './database';

export async function getAllApiKeys(db: TestifyDatabase): Promise<StoredApiKeyRecord[]> {
	try {
		return await db.apiKeys.toArray();
	} catch (err) {
		console.error('[DB] Failed to get API key records:', err);
		return [];
	}
}

export async function saveApiKeyRecord(
	db: TestifyDatabase,
	record: StoredApiKeyRecord
): Promise<void> {
	await db.apiKeys.put(toCloneable(record));
}

export async function deleteApiKeyRecord(db: TestifyDatabase, provider: AIProvider): Promise<void> {
	await db.apiKeys.delete(provider);
}

export async function clearAllApiKeys(db: TestifyDatabase): Promise<void> {
	await db.apiKeys.clear();
}
