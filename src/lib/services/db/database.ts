import Dexie, { type DexieOptions, type EntityTable } from 'dexie';
import type { AIProvider, StoredApiKeyRecord } from '$lib/types/apiKeys';
import type { PaperBlueprint } from '$lib/types/blueprint';
import type { DevPipelineTrace } from '$lib/types/devTrace';
import type { PdfExtractionResult } from '$lib/types/pdf';
import type { StoredGenerationJob } from '$lib/types/queue';
import type { SubjectItem } from '$lib/types/subject';
import type { TestAttempt, TestItem } from '$lib/types/test';
import * as apiKeysRepo from './apiKeys';
import * as attemptsRepo from './attempts';
import * as devTracesRepo from './devTraces';
import * as docAssetsRepo from './docAssets';
import * as generationJobsRepo from './generationJobs';
import * as settingsRepo from './settings';
import * as subjectsRepo from './subjects';
import * as testsRepo from './tests';
import type { AppSettingRecord, TestDocAssetRecord } from './types';

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
 */
export class TestifyDatabase extends Dexie {
	tests!: EntityTable<TestItem, 'id'>;
	subjects!: EntityTable<SubjectItem, 'id'>;
	settings!: EntityTable<AppSettingRecord, 'key'>;
	apiKeys!: EntityTable<StoredApiKeyRecord, 'provider'>;
	attempts!: EntityTable<TestAttempt, 'id'>;
	devTraces!: EntityTable<DevPipelineTrace, 'id'>;
	testDocAssets!: EntityTable<TestDocAssetRecord, 'testId'>;
	generationJobs!: EntityTable<StoredGenerationJob, 'id'>;

	constructor(dbName = 'TestifyDatabase', options?: DexieOptions) {
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
	saveSimilarPaperTest(test: TestItem): Promise<void> {
		return testsRepo.saveSimilarPaperTest(this, test);
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
}
