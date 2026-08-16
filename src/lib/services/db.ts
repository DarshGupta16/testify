import Dexie, { type DexieOptions, type EntityTable } from 'dexie';
import type { AIProvider, StoredApiKeyRecord } from '$lib/types/apiKeys';
import type { SubjectItem } from '$lib/types/subject';
import type { TestAttempt, TestItem } from '$lib/types/test';

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
 * 2. Academic Subjects (`subjects`)
 * 3. Application Preferences & State (`settings`)
 * 4. AI Provider Credentials (`apiKeys`)
 * 5. User Exam Session Attempts (`attempts`)
 */
export class TestifyDatabase extends Dexie {
	tests!: EntityTable<TestItem, 'id'>;
	subjects!: EntityTable<SubjectItem, 'id'>;
	settings!: EntityTable<AppSettingRecord, 'key'>;
	apiKeys!: EntityTable<StoredApiKeyRecord, 'provider'>;
	attempts!: EntityTable<TestAttempt, 'id'>;

	constructor(dbName = 'TestifyDatabase', options?: DexieOptions) {
		super(dbName, options);

		this.version(1).stores({
			tests: 'id, title, subjectId, createdAt, status',
			subjects: 'id, name, createdAt',
			settings: 'key, updatedAt',
			apiKeys: 'provider, securityMode, isEncrypted, updatedAt',
			attempts: 'id, testId, status, startedAt, completedAt, score',
		});
	}

	// --- Subjects CRUD Operations ---

	async getAllSubjects(): Promise<SubjectItem[]> {
		try {
			return await this.subjects.toArray();
		} catch (err) {
			console.error('[DB] Failed to get all subjects:', err);
			return [];
		}
	}

	async saveSubject(subject: SubjectItem): Promise<void> {
		await this.subjects.put(subject);
	}

	async bulkSaveSubjects(subjectsList: SubjectItem[]): Promise<void> {
		await this.subjects.bulkPut(subjectsList);
	}

	async deleteSubject(id: string): Promise<void> {
		await this.subjects.delete(id);
	}

	async clearAllSubjects(): Promise<void> {
		await this.subjects.clear();
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
		// Cascade delete attempts for this test
		await this.deleteAttemptsByTestId(id);
	}

	async clearAllTests(): Promise<void> {
		await this.tests.clear();
	}

	// --- Attempts CRUD Operations ---

	async getAllAttempts(): Promise<TestAttempt[]> {
		try {
			return await this.attempts.toArray();
		} catch (err) {
			console.error('[DB] Failed to get all attempts:', err);
			return [];
		}
	}

	async getAttemptsByTestId(testId: string): Promise<TestAttempt[]> {
		try {
			return await this.attempts.where('testId').equals(testId).toArray();
		} catch (err) {
			console.error(`[DB] Failed to get attempts for test "${testId}":`, err);
			return [];
		}
	}

	async getAttempt(id: string): Promise<TestAttempt | undefined> {
		try {
			return await this.attempts.get(id);
		} catch (err) {
			console.error(`[DB] Failed to get attempt "${id}":`, err);
			return undefined;
		}
	}

	async saveAttempt(attempt: TestAttempt): Promise<void> {
		await this.attempts.put(attempt);
	}

	async deleteAttempt(id: string): Promise<void> {
		await this.attempts.delete(id);
	}

	async deleteAttemptsByTestId(testId: string): Promise<void> {
		try {
			await this.attempts.where('testId').equals(testId).delete();
		} catch (err) {
			console.error(`[DB] Failed to delete attempts for test "${testId}":`, err);
		}
	}

	async clearAllAttempts(): Promise<void> {
		await this.attempts.clear();
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
