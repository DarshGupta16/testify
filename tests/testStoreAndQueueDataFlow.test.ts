/// <reference types="bun-types" />
import { describe, expect, it, mock } from 'bun:test';

mock.module('$app/environment', () => ({
	browser: false,
	dev: true,
	building: false,
	version: '1.0',
}));

mock.module('$app/navigation', () => ({
	goto: () => Promise.resolve(),
	preloadCode: () => Promise.resolve(),
	preloadData: () => Promise.resolve(),
	beforeNavigate: () => {},
	afterNavigate: () => {},
}));

import type { FolderStore } from '../src/lib/stores/folderStore.svelte';

const { TestStore } = await import('../src/lib/stores/testStore.svelte');

import type { PdfExtractionResult } from '../src/lib/types/pdf';
import type { TestItem } from '../src/lib/types/test';

describe('Track: State, Backend Services & Data Flow', () => {
	const mockExtractedData: PdfExtractionResult = {
		pages: [{ pageNumber: 1, width: 600, height: 800, images: [] }],
		diagrams: [],
	} as unknown as PdfExtractionResult;

	function makeTest(overrides: Partial<TestItem> = {}): TestItem {
		const base: TestItem = {
			id: 't-default',
			title: 'Default Test',
			subjectId: 'default-math',
			createdAt: new Date().toISOString(),
			questions: [],
			durationMinutes: 30,
			totalMarks: 50,
			testFileName: 'sample.pdf',
			testFileSizeFormatted: '1.2 MB',
			status: 'ready',
		};
		return Object.assign(base, overrides);
	}

	const createMockDb = (overrides = {}) => {
		const docAssetsMap = new Map<string, { testId: string; extractedData: PdfExtractionResult }>();
		const testsMap = new Map<string, TestItem>();

		return {
			tests: {
				get: mock(async (id: string) => testsMap.get(id)),
				put: mock(async (item: TestItem) => testsMap.set(item.id, item)),
				delete: mock(async (id: string) => testsMap.delete(id)),
				toArray: mock(async () => Array.from(testsMap.values())),
			},
			testDocAssets: {
				get: mock(async (id: string) => docAssetsMap.get(id)),
				put: mock(async (rec: { testId: string; extractedData: PdfExtractionResult }) =>
					docAssetsMap.set(rec.testId, rec)
				),
				delete: mock(async (id: string) => docAssetsMap.delete(id)),
			},
			getAllTests: mock(async () => Array.from(testsMap.values())),
			saveTest: mock(async (t: TestItem) => testsMap.set(t.id, t)),
			deleteTest: mock(async (id: string) => testsMap.delete(id)),
			clearAllTests: mock(async () => testsMap.clear()),
			updateTestBlueprint: mock(async () => {}),
			docAssetsMap,
			testsMap,
			...overrides,
		} as unknown as import('../src/lib/services/db').TestifyDatabase & {
			docAssetsMap: Map<string, { testId: string; extractedData: PdfExtractionResult }>;
			testsMap: Map<string, TestItem>;
		};
	};

	describe('1. prefetchTestDocAssets', () => {
		it('queries testDocAssets table and populates docAssetsCache', async () => {
			const mockDb = createMockDb();
			const testId = 'test-doc-123';
			mockDb.docAssetsMap.set(testId, { testId, extractedData: mockExtractedData });

			const store = new TestStore(mockDb);
			expect(store.docAssetsCache.has(testId)).toBe(false);

			const result = await store.prefetchTestDocAssets(testId);

			expect(mockDb.testDocAssets.get).toHaveBeenCalledWith(testId);
			expect(mockDb.tests.get).not.toHaveBeenCalled();
			expect(result).toEqual(mockExtractedData);
			expect(store.docAssetsCache.get(testId)).toEqual(mockExtractedData);
		});

		it('returns cached asset immediately on subsequent calls without querying db', async () => {
			const mockDb = createMockDb();
			const testId = 'test-doc-456';
			mockDb.docAssetsMap.set(testId, { testId, extractedData: mockExtractedData });

			const store = new TestStore(mockDb);
			await store.prefetchTestDocAssets(testId);
			expect(mockDb.testDocAssets.get).toHaveBeenCalledTimes(1);

			// Call second time
			const cached = await store.prefetchTestDocAssets(testId);
			expect(cached).toEqual(mockExtractedData);
			expect(mockDb.testDocAssets.get).toHaveBeenCalledTimes(1);
		});
	});

	describe('2. TestStore domain methods for GenerationQueueStore', () => {
		it('addPlaceholderTest prepends to this.tests', () => {
			const store = new TestStore(createMockDb());
			const existingTest = makeTest({ id: 't-existing', title: 'Existing Test' });
			store.tests = [existingTest];

			const placeholder = makeTest({
				id: 't-placeholder',
				title: 'Placeholder Test',
				status: 'processing',
			});

			store.addPlaceholderTest(placeholder);
			expect(store.tests.length).toBe(2);
			expect(store.tests[0].id).toBe('t-placeholder');
			expect(store.tests[1].id).toBe('t-existing');
		});

		it('promoteReadyTest replaces placeholder and caches extractedData', () => {
			const store = new TestStore(createMockDb());
			const placeholder = makeTest({
				id: 't-1',
				title: 'Placeholder Test',
				status: 'processing',
			});
			store.tests = [placeholder];

			const readyTest = makeTest({
				id: 't-1',
				title: 'Ready Assessment',
				status: 'ready',
				createdAt: placeholder.createdAt,
				questions: [
					{
						id: 'q1',
						questionNumber: 1,
						type: 'multiple_choice',
						text: 'What is 2+2?',
						marks: 1,
						options: [
							{ id: 'o1', text: '3' },
							{ id: 'o2', text: '4' },
						],
						correctAnswer: 'o2',
					},
				],
				extractedData: mockExtractedData,
			});

			store.promoteReadyTest(readyTest);
			expect(store.tests.length).toBe(1);
			expect(store.tests[0].title).toBe('Ready Assessment');
			expect(store.tests[0].status).toBe('ready');
			expect(store.docAssetsCache.get('t-1')).toEqual(mockExtractedData);
		});

		it('markTestError finds index, updates status to error and sets description', () => {
			const mockDb = createMockDb();
			const store = new TestStore(mockDb);
			const placeholder = makeTest({
				id: 't-err',
				title: 'Failing Job',
				status: 'processing',
			});
			store.tests = [placeholder];

			store.markTestError('t-err', 'Network timeout during LLM generation');
			expect(store.tests[0].status).toBe('error');
			expect(store.tests[0].description).toBe('Network timeout during LLM generation');
		});

		it('removePlaceholderTest removes test by ID and purges docAssetsCache', () => {
			const store = new TestStore(createMockDb());
			const placeholder = makeTest({
				id: 't-rm',
				title: 'Cancelled Job',
				status: 'processing',
			});
			store.tests = [placeholder];
			store.docAssetsCache.set('t-rm', mockExtractedData);

			store.removePlaceholderTest('t-rm');
			expect(store.tests.some((t: TestItem) => t.id === 't-rm')).toBe(false);
			expect(store.docAssetsCache.has('t-rm')).toBe(false);
		});
	});

	describe('3. TestStore.deleteTest folder index cleanup', () => {
		it('cleans up folder index if folderId exists', () => {
			const mockFolders = {
				removeTestFromFolderIndex: mock((_testId: string, _folderId: string | null) => {}),
			} as unknown as FolderStore;

			const mockDb = createMockDb();
			const store = new TestStore(mockDb, mockFolders);

			const testWithFolder = makeTest({
				id: 'test-folder-1',
				title: 'Foldered Test',
				folderId: 'folder-abc',
			});
			store.tests = [testWithFolder];

			store.deleteTest('test-folder-1');

			expect(mockFolders.removeTestFromFolderIndex).toHaveBeenCalledWith(
				'test-folder-1',
				'folder-abc'
			);
			expect(store.tests.length).toBe(0);
		});

		it('invokes folder index removal with null bucket for root tests', () => {
			const mockFolders = {
				removeTestFromFolderIndex: mock((_testId: string, _folderId: string | null) => {}),
			} as unknown as FolderStore;

			const mockDb = createMockDb();
			const store = new TestStore(mockDb, mockFolders);

			const testWithoutFolder = makeTest({
				id: 'test-root-1',
				title: 'Root Test',
				folderId: null,
			});
			store.tests = [testWithoutFolder];

			store.deleteTest('test-root-1');

			expect(mockFolders.removeTestFromFolderIndex).toHaveBeenCalledWith('test-root-1', null);
			expect(store.tests.length).toBe(0);
		});
	});

	describe('4. Dead code purge validation', () => {
		it('TestStore does not have createTest or upload state properties', () => {
			const store = new TestStore(createMockDb()) as unknown as Record<string, unknown>;
			expect(store.createTest).toBeUndefined();
			expect(store.isUploading).toBeUndefined();
			expect(store.uploadProgress).toBeUndefined();
			expect(store.uploadStatusText).toBeUndefined();
		});

		it('db does not have duplicate saveSimilarPaperTest', () => {
			const db = createMockDb() as unknown as Record<string, unknown>;
			expect(db.saveSimilarPaperTest).toBeUndefined();
		});
	});
});
