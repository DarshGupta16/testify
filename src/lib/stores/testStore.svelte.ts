import { SAMPLE_TESTS } from '$lib/data/sampleTests';
import { processTestUpload } from '$lib/services/testUploader';
import type { TestItem, TestUploadPayload } from '$lib/types/test';

const STORAGE_KEY_TESTS = 'testify_tests_data_v1';

export class TestStore {
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

	init() {
		if (typeof window === 'undefined') return;
		try {
			const savedTests = localStorage.getItem(STORAGE_KEY_TESTS);
			if (savedTests) {
				const parsed = JSON.parse(savedTests);
				if (Array.isArray(parsed)) {
					this.tests = parsed;
				}
			}
		} catch (e) {
			console.error('Failed to load saved tests from storage:', e);
		}
	}

	private persist() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY_TESTS, JSON.stringify(this.tests));
		} catch (e) {
			console.error('Failed to persist tests to storage:', e);
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

			this.tests = [newTest, ...this.tests];
			this.persist();
			return newTest;
		} finally {
			this.isUploading = false;
			this.uploadProgress = 0;
			this.uploadStatusText = '';
		}
	}

	deleteTest(id: string): TestItem | undefined {
		const target = this.tests.find((t) => t.id === id);
		this.tests = this.tests.filter((t) => t.id !== id);
		this.persist();
		return target;
	}

	clearAll() {
		this.tests = [];
		this.persist();
	}

	loadSamples() {
		this.tests = SAMPLE_TESTS;
		this.persist();
	}
}
