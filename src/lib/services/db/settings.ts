import { toCloneable } from '$lib/utils/snapshot.svelte';
import type { TestifyDatabase } from './database';

export async function getSetting<T>(db: TestifyDatabase, key: string, defaultValue: T): Promise<T> {
	try {
		const record = await db.settings.get(key);
		return record ? (record.value as T) : defaultValue;
	} catch (err) {
		console.error(`[DB] Failed to get setting "${key}":`, err);
		return defaultValue;
	}
}

export async function setSetting<T>(db: TestifyDatabase, key: string, value: T): Promise<void> {
	await db.settings.put(
		toCloneable({
			key,
			value,
			updatedAt: new Date().toISOString(),
		})
	);
}
