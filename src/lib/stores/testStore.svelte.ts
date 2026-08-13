import { getContext, setContext } from 'svelte';
import type {
	CategoryFilter,
	QuestionPreview,
	SortOption,
	TestItem,
	TestUploadPayload,
	ThemeMode,
} from '$lib/types/test';

const TEST_STORE_CONTEXT_KEY = Symbol('TEST_STORE_CONTEXT');
const STORAGE_KEY_TESTS = 'testify_tests_data_v1';
const STORAGE_KEY_THEME = 'testify_theme';

export class TestStore {
	// Reactive State (Svelte 5 Runes)
	tests = $state<TestItem[]>([]);
	searchQuery = $state<string>('');
	selectedCategory = $state<CategoryFilter>('All');
	sortBy = $state<SortOption>('newest');

	// UI Modal & Process States
	isUploadModalOpen = $state<boolean>(false);
	isDetailsModalOpen = $state<boolean>(false);
	selectedTest = $state<TestItem | null>(null);

	// Upload Simulation State
	isUploading = $state<boolean>(false);
	uploadProgress = $state<number>(0);
	uploadStatusText = $state<string>('');

	// Theme
	theme = $state<ThemeMode>('light');

	// Toast Notification State
	toast = $state<{
		message: string;
		type: 'success' | 'info' | 'warning' | 'error';
	} | null>(null);
	private toastTimer: ReturnType<typeof setTimeout> | null = null;

	// Derived computations
	filteredTests = $derived.by(() => {
		let list = [...this.tests];

		// Filter by Category
		if (this.selectedCategory !== 'All') {
			list = list.filter(
				(t) =>
					t.subject.toLowerCase() === this.selectedCategory.toLowerCase() ||
					t.tags.some((tag) => tag.toLowerCase() === this.selectedCategory.toLowerCase())
			);
		}

		// Filter by Search Query
		const query = this.searchQuery.trim().toLowerCase();
		if (query) {
			list = list.filter(
				(t) =>
					t.title.toLowerCase().includes(query) ||
					t.subject.toLowerCase().includes(query) ||
					t.testFileName.toLowerCase().includes(query) ||
					t.tags.some((tag) => tag.toLowerCase().includes(query))
			);
		}

		// Sorting
		switch (this.sortBy) {
			case 'newest':
				return list.sort(
					(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				);
			case 'oldest':
				return list.sort(
					(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
				);
			case 'questions-desc':
				return list.sort((a, b) => b.questionCount - a.questionCount);
			case 'questions-asc':
				return list.sort((a, b) => a.questionCount - b.questionCount);
			case 'duration-desc':
				return list.sort((a, b) => b.durationMinutes - a.durationMinutes);
			case 'title-asc':
				return list.sort((a, b) => a.title.localeCompare(b.title));
			default:
				return list;
		}
	});

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

	// --- Actions ---

	init() {
		if (typeof window === 'undefined') return;

		// Hydrate Theme
		const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) as ThemeMode | null;
		if (savedTheme === 'dark' || savedTheme === 'light') {
			this.setTheme(savedTheme);
		} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
			this.setTheme('dark');
		}

		// Hydrate Tests
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

	private persistTests() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY_TESTS, JSON.stringify(this.tests));
		} catch (e) {
			console.error('Failed to persist tests to storage:', e);
		}
	}

	showToast(message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') {
		if (this.toastTimer) clearTimeout(this.toastTimer);
		this.toast = { message, type };
		this.toastTimer = setTimeout(() => {
			this.toast = null;
		}, 3500);
	}

	setTheme(mode: ThemeMode) {
		this.theme = mode;
		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_KEY_THEME, mode);
			if (mode === 'dark') {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		}
	}

	toggleTheme() {
		this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
	}

	setSearch(query: string) {
		this.searchQuery = query;
	}

	setCategory(cat: CategoryFilter) {
		this.selectedCategory = cat;
	}

	setSort(sort: SortOption) {
		this.sortBy = sort;
	}

	openUploadModal() {
		this.isUploadModalOpen = true;
	}

	closeUploadModal() {
		if (!this.isUploading) {
			this.isUploadModalOpen = false;
		}
	}

	openDetailsModal(test: TestItem) {
		this.selectedTest = test;
		this.isDetailsModalOpen = true;
	}

	closeDetailsModal() {
		this.isDetailsModalOpen = false;
		this.selectedTest = null;
	}

	/**
	 * Async method to process test upload.
	 * Designed so that when the real backend API is hooked up,
	 * you only need to swap the simulated pipeline with your actual API endpoint.
	 */
	async addTest(payload: TestUploadPayload): Promise<TestItem> {
		this.isUploading = true;
		this.uploadProgress = 10;
		this.uploadStatusText = 'Reading and indexing test PDF...';

		try {
			// Stage 1: File reading
			await new Promise((r) => setTimeout(r, 450));
			this.uploadProgress = 40;
			this.uploadStatusText = 'Parsing questions, equations, and diagrams...';

			// Stage 2: Question extraction
			await new Promise((r) => setTimeout(r, 550));
			this.uploadProgress = 75;
			this.uploadStatusText = payload.answerKeyFile
				? 'Matching question keys with answer key PDF...'
				: 'Generating interactive test schema...';

			// Stage 3: Formatting & validation
			await new Promise((r) => setTimeout(r, 450));
			this.uploadProgress = 100;
			this.uploadStatusText = 'Test Ready!';

			await new Promise((r) => setTimeout(r, 200));

			const newId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
			const count = payload.questionCount || 25;
			const duration = payload.durationMinutes || 60;
			const totalMarks = payload.totalMarks || count * 4;

			// Generate mock questions for rich preview
			const mockQuestions: QuestionPreview[] = Array.from({ length: Math.min(count, 8) }).map(
				(_, i) => ({
					id: `q_${i + 1}`,
					questionNumber: i + 1,
					type: i % 3 === 0 ? 'numerical' : 'multiple_choice',
					text: `Sample question #${i + 1} extracted from ${payload.testFile?.name || 'test.pdf'}: Analyze the problem statement and determine the correct output.`,
					options:
						i % 3 === 0
							? undefined
							: [
									'Option A: First theoretical assumption',
									'Option B: Second validated parameter',
									'Option C: Constant deviation factor',
									'Option D: None of the above',
								],
					correctAnswer: i % 3 === 0 ? '42.5' : 'Option B: Second validated parameter',
					marks: 4,
				})
			);

			const newTest: TestItem = {
				id: newId,
				title: payload.title || 'Untitled Test',
				description:
					payload.description || `Generated from ${payload.testFile?.name || 'PDF Document'}`,
				subject: payload.subject || 'General',
				durationMinutes: duration,
				questionCount: count,
				totalMarks: totalMarks,
				hasAnswerKey: Boolean(payload.answerKeyFile),
				testFileName: payload.testFile?.name || 'test_paper.pdf',
				testFileSizeFormatted: payload.testFile?.formattedSize || '2.4 MB',
				answerKeyFileName: payload.answerKeyFile?.name,
				answerKeyFileSizeFormatted: payload.answerKeyFile?.formattedSize,
				createdAt: new Date().toISOString(),
				status: 'ready',
				tags: [payload.subject || 'General', `${duration}m`, `${count} Qs`],
				questions: mockQuestions,
			};

			this.tests = [newTest, ...this.tests];
			this.persistTests();

			this.showToast(`Test "${newTest.title}" created successfully!`, 'success');
			this.closeUploadModal();
			return newTest;
		} finally {
			this.isUploading = false;
			this.uploadProgress = 0;
			this.uploadStatusText = '';
		}
	}

	deleteTest(id: string) {
		const testToDelete = this.tests.find((t) => t.id === id);
		this.tests = this.tests.filter((t) => t.id !== id);
		this.persistTests();

		if (this.selectedTest?.id === id) {
			this.closeDetailsModal();
		}

		if (testToDelete) {
			this.showToast(`Test "${testToDelete.title}" deleted.`, 'info');
		}
	}

	clearAllTests() {
		this.tests = [];
		this.persistTests();
		this.showToast('All tests cleared.', 'warning');
	}

	loadSampleTests() {
		const sampleTests: TestItem[] = [
			{
				id: 'test_sample_1',
				title: 'AP Physics C: Mechanics & Electromagnetism',
				description:
					'Section 1 Multiple Choice & Section 2 Free Response questions with full solutions.',
				subject: 'STEM',
				durationMinutes: 90,
				questionCount: 35,
				totalMarks: 100,
				hasAnswerKey: true,
				testFileName: 'AP_Physics_C_2025_Final.pdf',
				testFileSizeFormatted: '4.8 MB',
				answerKeyFileName: 'AP_Physics_C_Answer_Key.pdf',
				answerKeyFileSizeFormatted: '1.2 MB',
				createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
				status: 'ready',
				tags: ['STEM', '90m', '35 Qs', 'AP Physics'],
				questions: [
					{
						id: 'q1',
						questionNumber: 1,
						type: 'multiple_choice',
						text: 'A block of mass m is released from rest at the top of a frictionless incline of angle θ. What is its acceleration down the incline?',
						options: ['g sin(θ)', 'g cos(θ)', 'g tan(θ)', 'g / sin(θ)'],
						correctAnswer: 'g sin(θ)',
						marks: 4,
					},
					{
						id: 'q2',
						questionNumber: 2,
						type: 'numerical',
						text: 'Calculate the total kinetic energy in Joules when a 2.0 kg particle has a velocity of 15 m/s.',
						correctAnswer: '225',
						marks: 4,
					},
				],
			},
			{
				id: 'test_sample_2',
				title: 'CS 2110: Data Structures & Algorithms Midterm',
				description: 'Binary Search Trees, Heaps, Graph Traversals, and Asymptotic Complexity.',
				subject: 'Computer Science',
				durationMinutes: 75,
				questionCount: 20,
				totalMarks: 80,
				hasAnswerKey: true,
				testFileName: 'CS2110_Midterm_Spring2026.pdf',
				testFileSizeFormatted: '3.1 MB',
				answerKeyFileName: 'CS2110_Official_Solutions.pdf',
				answerKeyFileSizeFormatted: '1.5 MB',
				createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
				status: 'ready',
				tags: ['Computer Science', '75m', '20 Qs', 'Algorithms'],
				questions: [
					{
						id: 'q1',
						questionNumber: 1,
						type: 'multiple_choice',
						text: 'What is the worst-case time complexity of searching an element in an unbalanced Binary Search Tree of n nodes?',
						options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
						correctAnswer: 'O(n)',
						marks: 4,
					},
				],
			},
			{
				id: 'test_sample_3',
				title: 'SAT Advanced Reading & Writing Diagnostics',
				description: 'Standardized reading comprehension modules, grammar mechanics, and rhetoric.',
				subject: 'Languages',
				durationMinutes: 64,
				questionCount: 54,
				totalMarks: 800,
				hasAnswerKey: false,
				testFileName: 'SAT_Diagnostic_Module_3.pdf',
				testFileSizeFormatted: '6.2 MB',
				createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
				status: 'ready',
				tags: ['Languages', '64m', '54 Qs', 'SAT'],
				questions: [
					{
						id: 'q1',
						questionNumber: 1,
						type: 'multiple_choice',
						text: 'Which choice completes the text with the most logical and precise word or phrase?',
						options: ['ubiquitous', 'ephemeral', 'parsimonious', 'judicious'],
						correctAnswer: 'ubiquitous',
						marks: 10,
					},
				],
			},
		];

		this.tests = sampleTests;
		this.persistTests();
		this.showToast('Loaded 3 sample tests for preview.', 'info');
	}
}

/**
 * Register the store in SvelteKit context (to be called in root layout)
 */
export function setTestStore(store: TestStore) {
	return setContext(TEST_STORE_CONTEXT_KEY, store);
}

/**
 * Retrieve the store from SvelteKit context
 */
export function getTestStore(): TestStore {
	const store = getContext<TestStore>(TEST_STORE_CONTEXT_KEY);
	if (!store) {
		throw new Error(
			'TestStore not found in context. Make sure setTestStore is called in +layout.svelte.'
		);
	}
	return store;
}
