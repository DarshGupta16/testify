import Dexie, { type DexieOptions, type EntityTable } from 'dexie';
import type { AIProvider, StoredApiKeyRecord } from '$lib/types/apiKeys';
import type { TestItem } from '$lib/types/test';

export interface AppSettingRecord {
	key: string;
	value: unknown;
	updatedAt: string;
}

/**
 * TestifyDatabase - Dexie IndexedDB Store
 *
 * Provides typed schemas and local persistence for:
 * 1. Test Items (`tests`)
 * 2. Application Preferences & State (`settings`)
 * 3. AI Provider Credentials (`apiKeys`)
 */
export class TestifyDatabase extends Dexie {
	tests!: EntityTable<TestItem, 'id'>;
	settings!: EntityTable<AppSettingRecord, 'key'>;
	apiKeys!: EntityTable<StoredApiKeyRecord, 'provider'>;

	constructor(dbName = 'TestifyDatabase', options?: DexieOptions) {
		super(dbName, options);

		// Schema definitions (Version 1)
		this.version(1).stores({
			tests: 'id, title, subject, createdAt, status',
			settings: 'key, updatedAt',
			apiKeys: 'provider, securityMode, isEncrypted, updatedAt',
		});
	}

	// --- Tests CRUD Operations ---

	async getAllTests(): Promise<TestItem[]> {
		try {
			return await this.tests.toArray();
		} catch (err) {
			console.error('[DB] Failed to get all tests:', err);
			return [];
		}
	}

	async saveTest(test: TestItem): Promise<void> {
		await this.tests.put(test);
	}

	async deleteTest(id: string): Promise<void> {
		await this.tests.delete(id);
	}

	async clearAllTests(): Promise<void> {
		await this.tests.clear();
	}

	// --- Settings CRUD Operations ---

	async getSetting<T>(key: string, defaultValue: T): Promise<T> {
		try {
			const record = await this.settings.get(key);
			return record ? (record.value as T) : defaultValue;
		} catch (err) {
			console.error(`[DB] Failed to get setting "${key}":`, err);
			return defaultValue;
		}
	}

	async setSetting<T>(key: string, value: T): Promise<void> {
		await this.settings.put({
			key,
			value,
			updatedAt: new Date().toISOString(),
		});
	}

	// --- API Keys CRUD Operations ---

	async getAllApiKeys(): Promise<StoredApiKeyRecord[]> {
		try {
			return await this.apiKeys.toArray();
		} catch (err) {
			console.error('[DB] Failed to get API key records:', err);
			return [];
		}
	}

	async saveApiKeyRecord(record: StoredApiKeyRecord): Promise<void> {
		await this.apiKeys.put(record);
	}

	async deleteApiKeyRecord(provider: AIProvider): Promise<void> {
		await this.apiKeys.delete(provider);
	}

	async clearAllApiKeys(): Promise<void> {
		await this.apiKeys.clear();
	}
}

/**
 * Singleton database instance
 */
export const db = new TestifyDatabase();

/**
 * Fire-and-forget helper that asynchronously executes a Promise in the background
 * without blocking the main UI thread, safely catching and logging any errors.
 */
export function fireAndForget(
	promise: Promise<unknown>,
	operationName = 'background persistence'
): void {
	promise.catch((error) => {
		console.error(`[Dexie DB Error during ${operationName}]:`, error);
	});
}
