import { db, fireAndForget, type TestifyDatabase } from '$lib/services/db';
import { precompileQuestionsMath } from '$lib/services/mathHtmlCompiler';
import type { FolderStore } from '$lib/stores/folderStore.svelte';
import type { PaperBlueprint } from '$lib/types/blueprint';
import type { DevPipelineTrace } from '$lib/types/devTrace';
import type { PdfExtractionResult } from '$lib/types/pdf';
import type { TestItem } from '$lib/types/test';

export class TestStore {
	private database: TestifyDatabase;
	private folders?: FolderStore;
	docAssetsCache = new Map<string, PdfExtractionResult>();

	tests = $state<TestItem[]>([]);

	// Derived metrics - only aggregate over ready tests, ignoring in-flight processing stubs
	readyTests = $derived(this.tests.filter((t) => t.status === 'ready' || !t.status));
	totalTests = $derived(this.readyTests.length);
	totalQuestions = $derived(
		this.readyTests.reduce((acc, curr) => acc + (curr.questions?.length || 0), 0)
	);
	totalDurationMinutes = $derived(
		this.readyTests.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0)
	);

	constructor(customDb: TestifyDatabase = db, folders?: FolderStore) {
		this.database = customDb;
		this.folders = folders;
	}

	setFolderStore(folders: FolderStore): void {
		this.folders = folders;
	}

	async init() {
		try {
			const savedTests = await this.database.getAllTests();
			if (savedTests && savedTests.length > 0) {
				let hasLegacyFields = false;
				const cleaned = savedTests.map((t) => {
					if ('tags' in t || 'questionCount' in t) {
						hasLegacyFields = true;
						const copy = { ...t };
						delete (copy as { tags?: unknown }).tags;
						delete (copy as { questionCount?: unknown }).questionCount;
						return copy;
					}
					return t;
				});

				this.tests = cleaned;

				// Populate in-memory docAssetsCache from loaded tests
				for (const t of cleaned) {
					if (t.extractedData) {
						this.docAssetsCache.set(t.id, t.extractedData);
					}
				}

				if (hasLegacyFields) {
					fireAndForget(
						this.database.bulkSaveTests(cleaned),
						'Sanitizing legacy test tags and questionCount in Dexie'
					);
				}

				// Background non-blocking precompilation for any legacy tests lacking pre-rendered HTML
				const needsPrecompile = this.tests.some((t) =>
					t.questions?.some((q) => !q.renderedTextHtml)
				);
				if (needsPrecompile) {
					const runBackgroundMathCompilation = () => {
						let modified = false;
						this.tests = this.tests.map((t) => {
							if (t.questions?.some((q) => !q.renderedTextHtml)) {
								modified = true;
								return {
									...t,
									questions: precompileQuestionsMath(t.questions),
								};
							}
							return t;
						});
						if (modified) {
							fireAndForget(
								this.database.bulkSaveTests(this.tests),
								'Persisting precompiled KaTeX HTML to Dexie'
							);
						}
					};

					if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
						window.requestIdleCallback(runBackgroundMathCompilation);
					} else {
						setTimeout(runBackgroundMathCompilation, 100);
					}
				}
			}
		} catch (err) {
			console.error('[TestStore] Error initializing from Dexie:', err);
		}
	}

	/**
	 * Prepend a placeholder test during background generation enqueue.
	 */
	addPlaceholderTest(test: TestItem): void {
		this.tests = [test, ...this.tests];
	}

	/**
	 * Promotes a generated test from placeholder/stub to ready in-memory and caches its doc assets.
	 */
	promoteReadyTest(test: TestItem): void {
		if (test.extractedData) {
			this.docAssetsCache.set(test.id, test.extractedData);
		}
		const index = this.tests.findIndex((t) => t.id === test.id);
		if (index !== -1) {
			const updatedTests = [...this.tests];
			updatedTests[index] = test;
			this.tests = updatedTests;
		} else {
			this.tests = [test, ...this.tests];
		}
	}

	/**
	 * Marks an in-flight test as error with the provided failure message.
	 */
	markTestError(testId: string, error: string): void {
		const index = this.tests.findIndex((t) => t.id === testId);
		if (index !== -1) {
			const errorTest: TestItem = {
				...this.tests[index],
				status: 'error',
				description: error,
			};
			const updatedTests = [...this.tests];
			updatedTests[index] = errorTest;
			this.tests = updatedTests;
			fireAndForget(
				this.database.saveTest(errorTest),
				`Updating test error stub "${testId}" in Dexie`
			);
		}
	}

	/**
	 * Removes a placeholder test by ID from in-memory tests and doc assets cache.
	 */
	removePlaceholderTest(testId: string): void {
		this.tests = this.tests.filter((t) => t.id !== testId);
		this.docAssetsCache.delete(testId);
	}

	deleteTest(id: string): TestItem | undefined {
		const target = this.tests.find((t) => t.id === id);
		this.docAssetsCache.delete(id);
		// 1. In-memory update synchronously
		this.tests = this.tests.filter((t) => t.id !== id);

		// 2. Clean up folder index (including root bucket)
		if (target && this.folders) {
			this.folders.removeTestFromFolderIndex(id, target.folderId ?? null);
		}

		// 3. Fire-and-forget async Dexie deletion
		fireAndForget(this.database.deleteTest(id), `Deleting Test "${id}" from Dexie`);

		return target;
	}

	updateTest(updated: TestItem): void {
		const index = this.tests.findIndex((t) => t.id === updated.id);
		if (index !== -1) {
			const existing = this.tests[index];
			// Invalidate blueprint cache if questions changed
			const questionsChanged =
				existing.questions !== updated.questions &&
				(existing.questions?.length !== updated.questions?.length ||
					JSON.stringify(existing.questions) !== JSON.stringify(updated.questions));

			if (questionsChanged) {
				updated.blueprint = undefined;
			}

			// Ensure modified questions have up-to-date pre-rendered KaTeX & Markdown HTML
			if (updated.questions && updated.questions.length > 0) {
				updated.questions = precompileQuestionsMath(updated.questions);
			}

			if (updated.extractedData) {
				this.docAssetsCache.set(updated.id, updated.extractedData);
			}

			this.tests[index] = updated;
			fireAndForget(this.database.saveTest(updated), `Updating Test "${updated.title}" in Dexie`);
		}
	}

	/**
	 * Updates the cached blueprint for a test in-memory and in Dexie.
	 */
	updateTestBlueprint(id: string, blueprint: PaperBlueprint): void {
		const target = this.tests.find((t) => t.id === id);
		if (target) {
			target.blueprint = blueprint;
		}
		fireAndForget(
			this.database.updateTestBlueprint(id, blueprint),
			`Caching blueprint on test "${id}" in Dexie`
		);
	}

	/**
	 * Domain method to reassign all tests associated with oldSubjectId to newSubjectId.
	 */
	reassignSubject(oldSubjectId: string, newSubjectId: string): void {
		const affectedTests = this.tests.filter((t) => t.subjectId === oldSubjectId);
		if (affectedTests.length === 0) return;

		this.tests = this.tests.map((t) =>
			t.subjectId === oldSubjectId ? { ...t, subjectId: newSubjectId } : t
		);

		for (const t of affectedTests) {
			fireAndForget(
				this.database.saveTest({ ...t, subjectId: newSubjectId }),
				`Reassigning test "${t.title}" to subject "${newSubjectId}"`
			);
		}
	}

	clearAll() {
		this.docAssetsCache.clear();
		// 1. In-memory update synchronously
		this.tests = [];

		// 2. Fire-and-forget async Dexie clear
		fireAndForget(this.database.clearAllTests(), 'Clearing all tests from Dexie');
	}

	/**
	 * Optimistically prefetches and caches extracted PDF assets (pages, diagrams)
	 * for a test to ensure instant 0ms tab switching and view rendering.
	 */
	async prefetchTestDocAssets(testId: string): Promise<PdfExtractionResult | undefined> {
		if (this.docAssetsCache.has(testId)) {
			return this.docAssetsCache.get(testId);
		}

		const inMemory = this.tests.find((t) => t.id === testId);
		if (inMemory?.extractedData) {
			this.docAssetsCache.set(testId, inMemory.extractedData);
			return inMemory.extractedData;
		}

		try {
			const dbAsset = await this.database.testDocAssets.get(testId);
			if (dbAsset?.extractedData) {
				this.docAssetsCache.set(testId, dbAsset.extractedData);
				if (inMemory && !inMemory.extractedData) {
					inMemory.extractedData = dbAsset.extractedData;
				}
				return dbAsset.extractedData;
			}
		} catch (err) {
			console.warn(`[TestStore] Failed to prefetch doc assets for "${testId}":`, err);
		}

		return undefined;
	}

	/**
	 * Retrieves cached extracted PDF assets or loads them on demand from IndexedDB.
	 */
	async getTestDocAssets(testId: string): Promise<PdfExtractionResult | undefined> {
		return this.prefetchTestDocAssets(testId);
	}

	/**
	 * Optimistically prefetches dev-only AI pipeline trace from IndexedDB.
	 */
	async prefetchDevTrace(testId: string): Promise<DevPipelineTrace | undefined> {
		try {
			return await this.database.getDevTrace(testId);
		} catch (err) {
			console.warn(`[TestStore] Failed to prefetch dev trace for "${testId}":`, err);
			return undefined;
		}
	}
}
