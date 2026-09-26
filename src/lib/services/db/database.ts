import Dexie, { type DexieOptions, type EntityTable } from 'dexie';
import type { AIProvider, StoredApiKeyRecord } from '$lib/types/apiKeys';
import type { PaperBlueprint } from '$lib/types/blueprint';
import type { DevPipelineTrace } from '$lib/types/devTrace';
import type { FolderItem } from '$lib/types/folder';
import type { PdfExtractionResult } from '$lib/types/pdf';
import type { StoredGenerationJob } from '$lib/types/queue';
import type { SubjectItem } from '$lib/types/subject';
import type { TestAttempt, TestItem } from '$lib/types/test';
import * as apiKeysRepo from './apiKeys';
import * as attemptsRepo from './attempts';
import * as devTracesRepo from './devTraces';
import * as docAssetsRepo from './docAssets';
import * as foldersRepo from './folders';
import * as generationJobsRepo from './generationJobs';
import * as offlineOpsRepo from './offlineOps';
import * as settingsRepo from './settings';
import * as subjectsRepo from './subjects';
import * as testsRepo from './tests';
import type { AppSettingRecord, OfflineOp, TestDocAssetRecord } from './types';

/**
 * TestifyDatabase - Dexie IndexedDB Store
 *
 * Provides typed schemas and local persistence for:
 * 1. Test Items (`tests`)
 * 2. Academic Subjects (`subjects`)
 * 3. Application Preferences & State (`settings`)
 * 4. AI Provider Credentials (`apiKeys`)
 * 5. User Exam Session Attempts (`attempts`)
 * 6. Dev-Only AI Pipeline Traces (`devTraces`)
 * 7. Heavy Extracted PDF Document Assets (`testDocAssets`)
 * 8. Background Test Generation Jobs (`generationJobs`)
 * 9. Hierarchical Folders (`folders`)
 */
/**
 * Resolves the physical Dexie database name for a user.
 * Database naming: testify_guest for guest, testify_${userId} for authenticated users.
 */
export function getUserDbName(userId?: string | null): string {
	if (!userId || typeof userId !== 'string' || userId.trim() === '') {
		return 'testify_guest';
	}
	return `testify_${userId.trim()}`;
}

export class TestifyDatabase extends Dexie {
	tests!: EntityTable<TestItem, 'id'>;
	folders!: EntityTable<FolderItem, 'id'>;
	subjects!: EntityTable<SubjectItem, 'id'>;
	settings!: EntityTable<AppSettingRecord, 'key'>;
	apiKeys!: EntityTable<StoredApiKeyRecord, 'provider'>;
	attempts!: EntityTable<TestAttempt, 'id'>;
	devTraces!: EntityTable<DevPipelineTrace, 'id'>;
	testDocAssets!: EntityTable<TestDocAssetRecord, 'testId'>;
	generationJobs!: EntityTable<StoredGenerationJob, 'id'>;
	offlineOps!: EntityTable<OfflineOp, 'id'>;

	constructor(dbName = getUserDbName(null), options?: DexieOptions) {
		super(dbName, options);

		this.version(1).stores({
			tests: 'id, title, subjectId, createdAt, status',
			subjects: 'id, name, createdAt',
			settings: 'key, updatedAt',
			apiKeys: 'provider, securityMode, isEncrypted, updatedAt',
			attempts: 'id, testId, status, startedAt, completedAt, score',
		});

		// Version 2 Migration: Clean up legacy arbitrary tags, questionCount, and subject color
		this.version(2).stores({
			tests: 'id, title, subjectId, createdAt, status',
			subjects: 'id, name, createdAt',
			settings: 'key, updatedAt',
			apiKeys: 'provider, securityMode, isEncrypted, updatedAt',
			attempts: 'id, testId, status, startedAt, completedAt, score',
		});

		// Version 3 Migration: Clean up legacy arbitrary tags, questionCount, and subject color using bulk overwrite
		this.version(3)
			.stores({
				tests: 'id, title, subjectId, createdAt, status',
				subjects: 'id, name, createdAt',
				settings: 'key, updatedAt',
				apiKeys: 'provider, securityMode, isEncrypted, updatedAt',
				attempts: 'id, testId, status, startedAt, completedAt, score',
			})
			.upgrade(async (tx) => {
				const testsTable = tx.table('tests');
				const allTests = await testsTable.toArray();
				if (allTests.length > 0) {
					const cleaned = allTests.map((t: Record<string, unknown>) => {
						const clone = { ...t };
						delete clone.tags;
						delete clone.questionCount;
						return clone;
					});
					await testsTable.bulkPut(cleaned);
				}

				const subjectsTable = tx.table('subjects');
				const allSubjects = await subjectsTable.toArray();
				if (allSubjects.length > 0) {
					const cleaned = allSubjects.map((s: Record<string, unknown>) => {
						const clone = { ...s };
						delete clone.color;
						return clone;
					});
					await subjectsTable.bulkPut(cleaned);
				}
			});

		// Version 4 Migration: Add devTraces table for development pipeline diagnostic inspection
		this.version(4).stores({
			tests: 'id, title, subjectId, createdAt, status',
			subjects: 'id, name, createdAt',
			settings: 'key, updatedAt',
			apiKeys: 'provider, securityMode, isEncrypted, updatedAt',
			attempts: 'id, testId, status, startedAt, completedAt, score',
			devTraces: 'id, testId, testTitle, createdAt, provider, model',
		});

		// Version 5 Migration: Decouple heavy extractedData assets from tests into dedicated testDocAssets store
		this.version(5)
			.stores({
				tests: 'id, title, subjectId, createdAt, status',
				subjects: 'id, name, createdAt',
				settings: 'key, updatedAt',
				apiKeys: 'provider, securityMode, isEncrypted, updatedAt',
				attempts: 'id, testId, status, startedAt, completedAt, score',
				devTraces: 'id, testId, testTitle, createdAt, provider, model',
				testDocAssets: 'testId',
			})
			.upgrade(async (tx) => {
				const testsTable = tx.table('tests');
				const testDocAssetsTable = tx.table('testDocAssets');
				const allTests = await testsTable.toArray();
				if (allTests.length > 0) {
					const testsToUpdate: Record<string, unknown>[] = [];
					const assetsToSave: { testId: string; extractedData: unknown }[] = [];

					for (const t of allTests) {
						const testRecord = t as Record<string, unknown>;
						if (testRecord.extractedData) {
							assetsToSave.push({
								testId: String(testRecord.id),
								extractedData: testRecord.extractedData,
							});
							const clone = { ...testRecord };
							delete clone.extractedData;
							testsToUpdate.push(clone);
						}
					}

					if (assetsToSave.length > 0) {
						await testDocAssetsTable.bulkPut(assetsToSave);
					}
					if (testsToUpdate.length > 0) {
						await testsTable.bulkPut(testsToUpdate);
					}
				}
			});

		// Version 6 Migration: Add generationJobs table for persistent async generation queue
		this.version(6).stores({
			tests: 'id, title, subjectId, createdAt, status',
			subjects: 'id, name, createdAt',
			settings: 'key, updatedAt',
			apiKeys: 'provider, securityMode, isEncrypted, updatedAt',
			attempts: 'id, testId, status, startedAt, completedAt, score',
			devTraces: 'id, testId, testTitle, createdAt, provider, model',
			testDocAssets: 'testId',
			generationJobs: 'id, status, createdAt, completedAt',
		});

		// Version 7 Migration: Add folders table and folderId indexing on tests & generationJobs
		this.version(7).stores({
			tests: 'id, title, subjectId, folderId, createdAt, status',
			folders: 'id, name, parentFolderId, order, createdAt',
			subjects: 'id, name, createdAt',
			settings: 'key, updatedAt',
			apiKeys: 'provider, securityMode, isEncrypted, updatedAt',
			attempts: 'id, testId, status, startedAt, completedAt, score',
			devTraces: 'id, testId, testTitle, createdAt, provider, model',
			testDocAssets: 'testId',
			generationJobs: 'id, folderId, status, createdAt, completedAt',
		});

		// Version 8 Migration: Add offlineOps table and updatedAt indexing for cross-device sync
		this.version(8)
			.stores({
				tests: 'id, title, subjectId, folderId, createdAt, updatedAt, status',
				folders: 'id, name, parentFolderId, order, createdAt, updatedAt',
				subjects: 'id, name, createdAt, updatedAt',
				settings: 'key, updatedAt',
				apiKeys: 'provider, securityMode, isEncrypted, updatedAt',
				attempts: 'id, testId, status, startedAt, completedAt, updatedAt, score',
				devTraces: 'id, testId, testTitle, createdAt, provider, model',
				testDocAssets: 'testId',
				generationJobs: 'id, folderId, status, createdAt, completedAt',
				offlineOps: '++id, table, action, recordId, timestamp',
			})
			.upgrade(async (tx) => {
				const now = new Date().toISOString();
				const testsTable = tx.table('tests');
				const allTests = await testsTable.toArray();
				for (const t of allTests) {
					if (!t.updatedAt) {
						t.updatedAt = t.createdAt || now;
						await testsTable.put(t);
					}
				}

				const foldersTable = tx.table('folders');
				const allFolders = await foldersTable.toArray();
				for (const f of allFolders) {
					if (!f.updatedAt) {
						f.updatedAt = f.createdAt || now;
						await foldersTable.put(f);
					}
				}

				const subjectsTable = tx.table('subjects');
				const allSubjects = await subjectsTable.toArray();
				for (const s of allSubjects) {
					if (!s.updatedAt) {
						s.updatedAt = s.createdAt || now;
						await subjectsTable.put(s);
					}
				}

				const attemptsTable = tx.table('attempts');
				const allAttempts = await attemptsTable.toArray();
				for (const a of allAttempts) {
					if (!a.updatedAt) {
						a.updatedAt = a.completedAt || a.startedAt || now;
						await attemptsTable.put(a);
					}
				}
			});
	}

	// --- Folders Operations ---
	getAllFolders(): Promise<FolderItem[]> {
		return foldersRepo.getAllFolders(this);
	}
	getFolderById(id: string): Promise<FolderItem | undefined> {
		return foldersRepo.getFolderById(this, id);
	}
	saveFolder(folder: FolderItem): Promise<void> {
		return foldersRepo.saveFolder(this, folder);
	}
	bulkSaveFolders(foldersList: FolderItem[]): Promise<void> {
		return foldersRepo.bulkSaveFolders(this, foldersList);
	}
	updateFolder(id: string, updates: Partial<FolderItem>): Promise<void> {
		return foldersRepo.updateFolder(this, id, updates);
	}
	deleteFolder(id: string): Promise<void> {
		return foldersRepo.deleteFolder(this, id);
	}
	clearAllFolders(): Promise<void> {
		return foldersRepo.clearAllFolders(this);
	}
	atomicCascadeDeleteFolder(
		folderIds: string[],
		testIds: string[],
		jobIds: string[] = []
	): Promise<void> {
		return foldersRepo.atomicCascadeDeleteFolder(this, folderIds, testIds, jobIds);
	}

	// --- Subjects Operations ---
	getAllSubjects(): Promise<SubjectItem[]> {
		return subjectsRepo.getAllSubjects(this);
	}
	saveSubject(subject: SubjectItem): Promise<void> {
		return subjectsRepo.saveSubject(this, subject);
	}
	bulkSaveSubjects(subjectsList: SubjectItem[]): Promise<void> {
		return subjectsRepo.bulkSaveSubjects(this, subjectsList);
	}
	deleteSubject(id: string): Promise<void> {
		return subjectsRepo.deleteSubject(this, id);
	}
	clearAllSubjects(): Promise<void> {
		return subjectsRepo.clearAllSubjects(this);
	}

	// --- Tests Operations ---
	getAllTests(): Promise<TestItem[]> {
		return testsRepo.getAllTests(this);
	}
	getTest(id: string): Promise<TestItem | undefined> {
		return testsRepo.getTestById(this, id);
	}
	saveTest(test: TestItem): Promise<void> {
		return testsRepo.saveTest(this, test);
	}
	updateTest(id: string, updates: Partial<TestItem>): Promise<void> {
		return testsRepo.updateTest(this, id, updates);
	}
	updateTestBlueprint(id: string, blueprint: PaperBlueprint): Promise<void> {
		return testsRepo.updateTestBlueprint(this, id, blueprint);
	}
	bulkSaveTests(testsList: TestItem[]): Promise<void> {
		return testsRepo.bulkSaveTests(this, testsList);
	}
	bulkUpdateTestFolder(testIds: string[], folderId: string | null): Promise<void> {
		return testsRepo.bulkUpdateTestFolder(this, testIds, folderId);
	}
	atomicCascadeDeleteTests(testIds: string[]): Promise<void> {
		return testsRepo.atomicCascadeDeleteTests(this, testIds);
	}
	deleteTest(id: string): Promise<void> {
		return testsRepo.deleteTest(this, id);
	}
	clearAllTests(): Promise<void> {
		return testsRepo.clearAllTests(this);
	}

	// --- Attempts Operations ---
	getAllAttempts(): Promise<TestAttempt[]> {
		return attemptsRepo.getAllAttempts(this);
	}
	getAttemptsByTestId(testId: string): Promise<TestAttempt[]> {
		return attemptsRepo.getAttemptsByTestId(this, testId);
	}
	getAttempt(id: string): Promise<TestAttempt | undefined> {
		return attemptsRepo.getAttempt(this, id);
	}
	saveAttempt(attempt: TestAttempt): Promise<void> {
		return attemptsRepo.saveAttempt(this, attempt);
	}
	bulkSaveAttempts(attemptsList: TestAttempt[]): Promise<void> {
		return attemptsRepo.bulkSaveAttempts(this, attemptsList);
	}
	deleteAttempt(id: string): Promise<void> {
		return attemptsRepo.deleteAttempt(this, id);
	}
	deleteAttemptsByTestId(testId: string): Promise<void> {
		return attemptsRepo.deleteAttemptsByTestId(this, testId);
	}
	clearAllAttempts(): Promise<void> {
		return attemptsRepo.clearAllAttempts(this);
	}

	// --- Settings Operations ---
	getSetting<T>(key: string, defaultValue: T): Promise<T> {
		return settingsRepo.getSetting(this, key, defaultValue);
	}
	setSetting<T>(key: string, value: T): Promise<void> {
		return settingsRepo.setSetting(this, key, value);
	}

	// --- API Keys Operations ---
	getAllApiKeys(): Promise<StoredApiKeyRecord[]> {
		return apiKeysRepo.getAllApiKeys(this);
	}
	saveApiKeyRecord(record: StoredApiKeyRecord): Promise<void> {
		return apiKeysRepo.saveApiKeyRecord(this, record);
	}
	deleteApiKeyRecord(provider: AIProvider): Promise<void> {
		return apiKeysRepo.deleteApiKeyRecord(this, provider);
	}
	clearAllApiKeys(): Promise<void> {
		return apiKeysRepo.clearAllApiKeys(this);
	}

	// --- Dev-Only Pipeline Traces Operations ---
	saveDevTrace(trace: DevPipelineTrace): Promise<void> {
		return devTracesRepo.saveDevTrace(this, trace);
	}
	getDevTrace(testId: string): Promise<DevPipelineTrace | undefined> {
		return devTracesRepo.getDevTrace(this, testId);
	}
	getAllDevTraces(): Promise<DevPipelineTrace[]> {
		return devTracesRepo.getAllDevTraces(this);
	}
	deleteDevTrace(id: string): Promise<void> {
		return devTracesRepo.deleteDevTrace(this, id);
	}
	clearAllDevTraces(): Promise<void> {
		return devTracesRepo.clearAllDevTraces(this);
	}

	// --- Test Document Assets Operations ---
	getTestDocAssets(testId: string): Promise<PdfExtractionResult | undefined> {
		return docAssetsRepo.getTestDocAssets(this, testId);
	}
	saveTestDocAssets(testId: string, assets: PdfExtractionResult): Promise<void> {
		return docAssetsRepo.saveTestDocAssets(this, testId, assets);
	}
	deleteTestDocAssets(testId: string): Promise<void> {
		return docAssetsRepo.deleteTestDocAssets(this, testId);
	}

	// --- Generation Jobs Operations ---
	getAllGenerationJobs(): Promise<StoredGenerationJob[]> {
		return generationJobsRepo.getAllJobs(this);
	}
	getGenerationJob(id: string): Promise<StoredGenerationJob | undefined> {
		return generationJobsRepo.getJobById(this, id);
	}
	getIncompleteGenerationJobs(): Promise<StoredGenerationJob[]> {
		return generationJobsRepo.getIncompleteJobs(this);
	}
	saveGenerationJob(job: StoredGenerationJob): Promise<void> {
		return generationJobsRepo.saveJob(this, job);
	}
	bulkSaveGenerationJobs(jobs: StoredGenerationJob[]): Promise<void> {
		return generationJobsRepo.bulkSaveJobs(this, jobs);
	}
	updateGenerationJob(id: string, updates: Partial<StoredGenerationJob>): Promise<void> {
		return generationJobsRepo.updateJob(this, id, updates);
	}
	updateJobBlueprintCache(id: string, blueprint: PaperBlueprint): Promise<void> {
		return generationJobsRepo.updateJobBlueprintCache(this, id, blueprint);
	}
	deleteGenerationJob(id: string): Promise<void> {
		return generationJobsRepo.deleteJob(this, id);
	}
	clearCompletedGenerationJobs(): Promise<void> {
		return generationJobsRepo.clearCompletedJobs(this);
	}
	clearAllGenerationJobs(): Promise<void> {
		return generationJobsRepo.clearAllJobs(this);
	}

	// --- Offline Operations ---
	getAllOfflineOps(): Promise<OfflineOp[]> {
		return offlineOpsRepo.getAllOfflineOps(this);
	}
	addOfflineOp(op: Omit<OfflineOp, 'id' | 'timestamp'>): Promise<number | undefined> {
		return offlineOpsRepo.addOfflineOp(this, op);
	}
	deleteOfflineOp(id: number): Promise<void> {
		return offlineOpsRepo.deleteOfflineOp(this, id);
	}
	clearAllOfflineOps(): Promise<void> {
		return offlineOpsRepo.clearAllOfflineOps(this);
	}
}

// Cache of open database instances keyed by partition name
const databaseInstances = new Map<string, TestifyDatabase>();
let currentActiveDbName = getUserDbName(null);

/**
 * Returns the partitioned TestifyDatabase instance for a specific user ID (or guest if null/omitted).
 * Does not change the globally active database partition.
 */
export function getDatabaseForUser(userId?: string | null): TestifyDatabase {
	const dbName = getUserDbName(userId);
	let instance = databaseInstances.get(dbName);
	if (!instance) {
		instance = new TestifyDatabase(dbName);
		databaseInstances.set(dbName, instance);
	}
	return instance;
}

/**
 * Returns the currently active partitioned TestifyDatabase instance.
 * Defaults to 'testify_guest' if no user session has been activated.
 */
export function getActiveDatabase(): TestifyDatabase {
	let instance = databaseInstances.get(currentActiveDbName);
	if (!instance) {
		instance = new TestifyDatabase(currentActiveDbName);
		databaseInstances.set(currentActiveDbName, instance);
	}
	return instance;
}

/**
 * Switches the active database partition to the specified user ID (or guest if omitted/null).
 * Returns the newly active TestifyDatabase instance.
 */
export function switchActiveDatabase(userId?: string | null): TestifyDatabase {
	const targetDbName = getUserDbName(userId);
	currentActiveDbName = targetDbName;
	return getActiveDatabase();
}

/**
 * Deletes a user's physical Dexie database partition from IndexedDB.
 * If the deleted database was currently active, switches to testify_guest.
 */
export async function deleteUserDatabase(userId: string): Promise<void> {
	if (!userId || typeof userId !== 'string') return;
	const dbName = getUserDbName(userId);

	if (currentActiveDbName === dbName) {
		switchActiveDatabase(null);
	}

	const existing = databaseInstances.get(dbName);
	if (existing) {
		try {
			existing.close();
		} catch {
			// ignore
		}
		databaseInstances.delete(dbName);
	}

	if (typeof indexedDB !== 'undefined' && typeof Dexie.delete === 'function') {
		try {
			await Dexie.delete(dbName);
		} catch (err) {
			console.warn('[Dexie Partitioning] Failed deleting database:', err);
		}
	}
}

/**
 * Migrates data from the legacy unpartitioned 'TestifyDatabase' into 'testify_guest'
 * if the legacy database exists.
 * Always ensures the legacy 'TestifyDatabase' is unconditionally deleted from IndexedDB.
 */
let legacyMigrationAttempted = false;
export async function migrateLegacyDatabaseIfNeeded(guestDb?: TestifyDatabase): Promise<void> {
	if (legacyMigrationAttempted) return;
	legacyMigrationAttempted = true;

	try {
		if (typeof indexedDB === 'undefined' || typeof Dexie.exists !== 'function') {
			return;
		}

		const legacyExists = await Dexie.exists('TestifyDatabase');
		if (!legacyExists) return;

		const targetGuestDb = guestDb ?? getDatabaseForUser(null);

		// Check if migration has already been completed in the past
		const isMigrated = await targetGuestDb.getSetting<boolean>('legacy_database_migrated', false).catch(() => false);

		if (!isMigrated) {
			// Check if guest database already has data
			const [guestTests, guestFolders] = await Promise.all([
				targetGuestDb.tests.count().catch(() => 0),
				targetGuestDb.folders.count().catch(() => 0),
			]);

			if (guestTests === 0 && guestFolders === 0) {
				const legacyDb = new TestifyDatabase('TestifyDatabase');
				try {
					await legacyDb.open();

					const [
						tests,
						folders,
						subjects,
						settings,
						apiKeys,
						attempts,
						devTraces,
						testDocAssets,
						generationJobs,
						offlineOps,
					] = await Promise.all([
						legacyDb.tests.toArray().catch(() => []),
						legacyDb.folders.toArray().catch(() => []),
						legacyDb.subjects.toArray().catch(() => []),
						legacyDb.settings.toArray().catch(() => []),
						legacyDb.apiKeys.toArray().catch(() => []),
						legacyDb.attempts.toArray().catch(() => []),
						legacyDb.devTraces.toArray().catch(() => []),
						legacyDb.testDocAssets.toArray().catch(() => []),
						legacyDb.generationJobs.toArray().catch(() => []),
						legacyDb.offlineOps.toArray().catch(() => []),
					]);

					if (tests.length > 0) await targetGuestDb.tests.bulkPut(tests);
					if (folders.length > 0) await targetGuestDb.folders.bulkPut(folders);
					if (subjects.length > 0) await targetGuestDb.subjects.bulkPut(subjects);
					if (settings.length > 0) await targetGuestDb.settings.bulkPut(settings);
					if (apiKeys.length > 0) await targetGuestDb.apiKeys.bulkPut(apiKeys);
					if (attempts.length > 0) await targetGuestDb.attempts.bulkPut(attempts);
					if (devTraces.length > 0) await targetGuestDb.devTraces.bulkPut(devTraces);
					if (testDocAssets.length > 0) await targetGuestDb.testDocAssets.bulkPut(testDocAssets);
					if (generationJobs.length > 0) await targetGuestDb.generationJobs.bulkPut(generationJobs);
					if (offlineOps.length > 0) await targetGuestDb.offlineOps.bulkPut(offlineOps);

					console.info('[Dexie Partitioning] Legacy data successfully migrated to testify_guest');
				} catch (copyErr) {
					console.warn('[Dexie Partitioning] Legacy copy warning:', copyErr);
				} finally {
					legacyDb.close();
				}
			}

			await targetGuestDb.setSetting('legacy_database_migrated', true).catch(() => {});
		}

		// ALWAYS ensure any open or cached connection to TestifyDatabase is closed, then delete it
		const cachedLegacy = databaseInstances.get('TestifyDatabase');
		if (cachedLegacy) {
			try {
				cachedLegacy.close();
			} catch {
				// ignore
			}
			databaseInstances.delete('TestifyDatabase');
		}

		try {
			await Dexie.delete('TestifyDatabase');
			console.info('[Dexie Partitioning] Legacy TestifyDatabase deleted from IndexedDB');
		} catch (delErr) {
			console.warn('[Dexie Partitioning] Failed deleting legacy TestifyDatabase:', delErr);
		}
	} catch (err) {
		console.warn('[Dexie Partitioning] Legacy migration error or skipped:', err);
	}
}

/**
 * Test utility to reset active database state and cached instances.
 */
export function _resetDatabaseInstancesForTesting(): void {
	for (const instance of databaseInstances.values()) {
		try {
			instance.close();
		} catch {
			// ignore in tests
		}
	}
	databaseInstances.clear();
	currentActiveDbName = getUserDbName(null);
	legacyMigrationAttempted = false;
}
