import { SAMPLE_TESTS } from '$lib/data/sampleTests';
import { db, fireAndForget, type TestifyDatabase } from '$lib/services/db';
import { SETTINGS_KEYS } from '$lib/services/settings';
import { processTestUpload } from '$lib/services/testUploader';
import type { TestItem, TestUploadPayload } from '$lib/types/test';

export class TestStore {
	private database: TestifyDatabase;

	tests = $state<TestItem[]>([]);

	// Upload execution state
	isUploading = $state<boolean>(false);
	uploadProgress = $state<number>(0);
	uploadStatusText = $state<string>('');

	// Derived metrics
	totalTests = $derived(this.tests.length);
	totalQuestions = $derived(this.tests.reduce((acc, curr) => acc + (curr.questionCount || 0), 0));
	totalDurationMinutes = $derived(
		this.tests.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0)
	);
	answerKeyCoverage = $derived.by(() => {
		if (this.tests.length === 0) return 0;
		const withKeys = this.tests.filter((t) => t.hasAnswerKey).length;
		return Math.round((withKeys / this.tests.length) * 100);
	});

	constructor(customDb: TestifyDatabase = db) {
		this.database = customDb;
	}

	async init() {
		try {
			// 1. Load from Dexie IndexedDB
			const savedTests = await this.database.getAllTests();

			if (savedTests && savedTests.length > 0) {
				this.tests = savedTests;
				return;
			}

			// 2. Migration fallback: check legacy localStorage if Dexie is empty
			if (typeof window !== 'undefined') {
				const legacyData = localStorage.getItem(SETTINGS_KEYS.LEGACY_TESTS_V1);
				if (legacyData) {
					try {
						const parsed = JSON.parse(legacyData);
						if (Array.isArray(parsed) && parsed.length > 0) {
							this.tests = parsed;
							// Migrate all legacy tests to Dexie in background
							fireAndForget(
								Promise.all(parsed.map((t) => this.database.saveTest(t))),
								'Migrating legacy localStorage tests to Dexie'
							);
							// Clean up legacy localStorage key
							localStorage.removeItem(SETTINGS_KEYS.LEGACY_TESTS_V1);
						}
					} catch (e) {
						console.error('[TestStore] Failed parsing legacy tests:', e);
					}
				}
			}
		} catch (err) {
			console.error('[TestStore] Error initializing from Dexie:', err);
		}
	}

	async createTest(payload: TestUploadPayload): Promise<TestItem> {
		this.isUploading = true;
		this.uploadProgress = 0;
		this.uploadStatusText = 'Initiating upload...';

		try {
			const newTest = await processTestUpload(payload, (progress, statusText) => {
				this.uploadProgress = progress;
				this.uploadStatusText = statusText;
			});

			// 1. In-memory update synchronously
			this.tests = [newTest, ...this.tests];

			// 2. Fire-and-forget async Dexie save
			fireAndForget(this.database.saveTest(newTest), `Saving Test "${newTest.title}" to Dexie`);

			return newTest;
		} finally {
			this.isUploading = false;
			this.uploadProgress = 0;
			this.uploadStatusText = '';
		}
	}

	deleteTest(id: string): TestItem | undefined {
		const target = this.tests.find((t) => t.id === id);
		// 1. In-memory update synchronously
		this.tests = this.tests.filter((t) => t.id !== id);

		// 2. Fire-and-forget async Dexie deletion
		fireAndForget(this.database.deleteTest(id), `Deleting Test "${id}" from Dexie`);

		return target;
	}

	clearAll() {
		// 1. In-memory update synchronously
		this.tests = [];

		// 2. Fire-and-forget async Dexie clear
		fireAndForget(this.database.clearAllTests(), 'Clearing all tests from Dexie');
	}

	loadSamples() {
		// 1. In-memory update synchronously
		this.tests = SAMPLE_TESTS;

		// 2. Fire-and-forget async Dexie persistence
		fireAndForget(
			Promise.all(SAMPLE_TESTS.map((t) => this.database.saveTest(t))),
			'Persisting sample tests to Dexie'
		);
	}
}
