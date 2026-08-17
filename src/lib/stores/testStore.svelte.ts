import { db, fireAndForget, type TestifyDatabase } from '$lib/services/db';
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

	constructor(customDb: TestifyDatabase = db) {
		this.database = customDb;
	}

	async init() {
		try {
			const savedTests = await this.database.getAllTests();
			if (savedTests && savedTests.length > 0) {
				this.tests = savedTests;
			}
		} catch (err) {
			console.error('[TestStore] Error initializing from Dexie:', err);
		}
	}

	async createTest(payload: TestUploadPayload, apiKey?: string): Promise<TestItem> {
		this.isUploading = true;
		this.uploadProgress = 0;
		this.uploadStatusText = 'Initiating upload...';

		try {
			const newTest = await processTestUpload(payload, {
				apiKey,
				onProgress: (progress, statusText) => {
					this.uploadProgress = progress;
					this.uploadStatusText = statusText;
				},
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

	updateTest(updated: TestItem): void {
		const index = this.tests.findIndex((t) => t.id === updated.id);
		if (index !== -1) {
			this.tests[index] = updated;
			this.tests = [...this.tests];
			fireAndForget(this.database.saveTest(updated), `Updating Test "${updated.title}" in Dexie`);
		}
	}

	clearAll() {
		// 1. In-memory update synchronously
		this.tests = [];

		// 2. Fire-and-forget async Dexie clear
		fireAndForget(this.database.clearAllTests(), 'Clearing all tests from Dexie');
	}
}
