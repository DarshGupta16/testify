import { getContext, setContext } from 'svelte';
import { goto } from '$app/navigation';
import { db, fireAndForget } from '$lib/services/db';
import { SETTINGS_KEYS } from '$lib/services/settings';
import { supabase, trySupabaseOrQueue } from '$lib/services/supabase';
import type { AIProvider, SecurityMode } from '$lib/types/apiKeys';
import type { PdfExtractionResult } from '$lib/types/pdf';
import { DEFAULT_SUBJECT_IDS } from '$lib/types/subject';
import type { TestItem } from '$lib/types/test';
import { ApiKeyStore } from './apiKeyStore.svelte';
import { AttemptStore } from './attemptStore.svelte';
import { AuthStore } from './authStore.svelte';
import { FilterStore } from './filterStore.svelte';
import { FolderStore } from './folderStore.svelte';
import { GenerationQueueStore } from './generationQueueStore.svelte';
import { ModalStore } from './modalStore.svelte';
import { NetworkStore } from './networkStore.svelte';
import { SecurityStore } from './securityStore.svelte';
import { SubjectStore } from './subjectStore.svelte';
import { TestStore } from './testStore.svelte';
import { ThemeStore } from './themeStore.svelte';
import { ToastStore } from './toastStore.svelte';

// Context key for Svelte component tree injection (using Symbol.for guarantees identity stability during Vite HMR)
const APP_CONTEXT_KEY = Symbol.for('TESTIFY_APP_CONTEXT');

export class AppStore {
	// Specialized Domain Sub-Stores
	readonly auth = new AuthStore();
	readonly subjects = new SubjectStore();
	readonly folders = new FolderStore();
	readonly tests = new TestStore(db, this.folders);
	readonly attempts = new AttemptStore();
	readonly filter = new FilterStore();
	readonly modals = new ModalStore();
	readonly theme = new ThemeStore();
	readonly toast = new ToastStore();
	readonly security = new SecurityStore();
	readonly apiKeys = new ApiKeyStore();
	readonly network = new NetworkStore();
	readonly queue = new GenerationQueueStore();

	// Global extraction scale preference (1.0x, 1.25x, 1.5x, 2.0x)
	selectedScale = $state<number>(1.25);

	// Global safety preference: confirm before deleting folders
	confirmFolderDelete = $state<boolean>(true);

	// Guard flag to prevent URL sync effects from wiping undo toasts during active folder deletions
	isDeletingFolder = $state<boolean>(false);

	// Composed Derived Reactive Queries
	readonly filteredTests = $derived.by(() => {
		return this.filter.apply(
			this.tests.tests,
			(id) => this.subjects.getName(id),
			this.folders.activeFolderId,
			(folderId) => this.folders.getTestIdsInFolder(folderId)
		);
	});

	constructor() {
		this.tests.setFolderStore(this.folders);
	}

	async init() {
		// 1. Initialize persistent UI preferences, subjects, folders, tests, & local exam collections
		await this.theme.init();
		await this.subjects.init();
		await this.folders.init();
		await this.tests.init();

		// Sanitize dangling folderId on tests if folder does not exist
		const testsWithDanglingFolder: TestItem[] = [];
		for (const test of this.tests.tests) {
			if (test.folderId && !this.folders.folderMap.has(test.folderId)) {
				test.folderId = null;
				testsWithDanglingFolder.push(test);
			}
		}
		if (testsWithDanglingFolder.length > 0) {
			fireAndForget(
				db.bulkSaveTests(testsWithDanglingFolder),
				'Sanitizing tests with dangling folder references in Dexie'
			);
		}

		this.folders.rebuildIndices(this.tests.tests);
		await this.attempts.init();

		// 2. Initialize network & PWA installation status
		this.network.init(
			() => {
				this.toast.show('Back online! Internet connection restored.', 'info', 4000);
				this.auth.startSyncCycle();
			},
			() => {
				this.toast.show('You are offline. Testify is running from local storage.', 'warning', 5000);
			}
		);

		// 3. Wire security session expiry hook to key purge
		this.security.setOnSessionExpire(() => {
			this.apiKeys.purgeMemory();
		});

		// 4. Initialize security authentication state and API key records
		await this.security.init();
		await this.apiKeys.init(this.security.securityMode);

		// 5. Initialize background generation queue worker & restore session jobs
		await this.queue.init(this);

		// 6. Initialize Supabase cloud auth session & synchronization engine
		await this.auth.init(this);

		// 6. Load saved extraction scale from Dexie
		try {
			const savedScale = await db.getSetting<number>(SETTINGS_KEYS.EXTRACTION_SCALE, 1.25);
			if (typeof savedScale === 'number' && savedScale > 0) {
				this.selectedScale = savedScale;
			}
		} catch (err) {
			console.error('[AppStore] Failed loading scale preference:', err);
		}

		// 7. Load saved folder delete confirmation preference
		try {
			const savedConfirm = await db.getSetting<boolean>(SETTINGS_KEYS.CONFIRM_FOLDER_DELETE, true);
			if (typeof savedConfirm === 'boolean') {
				this.confirmFolderDelete = savedConfirm;
			}
		} catch (err) {
			console.error('[AppStore] Failed loading confirm folder delete preference:', err);
		}

		// 8. Register window beforeunload flush for any pending folder deletion
		if (typeof window !== 'undefined') {
			window.addEventListener('beforeunload', () => {
				if (this.commitTimeout) {
					clearTimeout(this.commitTimeout);
					this.commitTimeout = null;
				}
				if (this.pendingFolderDeleteCommit) {
					this.pendingFolderDeleteCommit();
					this.pendingFolderDeleteCommit = null;
				}
			});
		}
	}

	setScale(scale: number) {
		this.selectedScale = scale;
		fireAndForget(
			db.setSetting(SETTINGS_KEYS.EXTRACTION_SCALE, scale),
			`Persisting scale setting (${scale}) to Dexie`
		);
	}

	setConfirmFolderDelete(enabled: boolean) {
		this.confirmFolderDelete = enabled;
		fireAndForget(
			db.setSetting(SETTINGS_KEYS.CONFIRM_FOLDER_DELETE, enabled),
			`Persisting confirm folder delete preference (${enabled})`
		);
	}

	// --- Linear Security & Authentication Orchestration ---

	async handleUnlock(password: string): Promise<boolean> {
		// 1. Atomically decrypt keys with provided password (throws if incorrect)
		await this.apiKeys.decryptAllKeys(password);

		// 2. Activate unlocked session in security store
		this.security.unlock(password);
		return true;
	}

	handleLock(reason?: string): void {
		this.security.lock(reason);
		this.apiKeys.purgeMemory();
	}

	async handleSetMasterPassword(password: string): Promise<void> {
		// 1. Encrypt existing in-memory keys with new master password
		await this.apiKeys.encryptAllKeys(password);

		// 2. Activate master password and switch to Strict mode
		await this.security.setMasterPassword(password);
	}

	async handleResetMasterPassword(): Promise<void> {
		// 1. Purge all encrypted key records
		await this.apiKeys.clearAllKeys();

		// 2. Reset master password settings and return to Lax mode
		await this.security.resetMasterPassword();
	}

	async handleSwitchSecurityMode(targetMode: SecurityMode, password?: string): Promise<void> {
		if (this.security.securityMode === targetMode) return;

		// 1. Migrate stored credentials format
		if (targetMode === 'strict') {
			if (!password) {
				throw new Error('Master password is required to switch to Strict mode.');
			}
			await this.apiKeys.encryptAllKeys(password);
		} else {
			await this.apiKeys.makeAllKeysPlaintext();
		}

		// 2. Commit security mode state change
		await this.security.switchSecurityMode(targetMode, password);
	}

	handleSaveKey(provider: AIProvider, key: string, password?: string): void {
		const pwd = password || this.security.getActiveMasterPassword();
		this.apiKeys.setKey(provider, key, this.security.securityMode, pwd);
	}

	// --- High-Level Test Orchestration Methods ---

	handleUpdateTest(updatedTest: TestItem): void {
		const existing = this.tests.tests.find((t) => t.id === updatedTest.id);
		if (existing && existing.folderId !== updatedTest.folderId) {
			this.folders.moveTestInIndex(
				updatedTest.id,
				existing.folderId ?? null,
				updatedTest.folderId ?? null
			);
		}
		this.tests.updateTest(updatedTest);
		if (this.modals.selectedTest?.id === updatedTest.id) {
			this.modals.selectedTest = { ...updatedTest };
		}
		if (this.modals.editingTest?.id === updatedTest.id) {
			this.modals.editingTest = { ...updatedTest };
		}
		this.toast.show(`Test "${updatedTest.title}" updated successfully!`, 'success');
	}

	handleDeleteTest(id: string) {
		const activeJob = this.queue.jobs.find((j) => j.testId === id || j.resultTestId === id);
		if (activeJob) {
			this.queue.cancelJob(activeJob.id);
		}
		const deleted = this.tests.deleteTest(id);
		this.attempts.deleteAttemptsForTest(id);
		if (this.modals.selectedTest?.id === id) {
			this.modals.closeDetails();
		}
		if (deleted) {
			this.toast.show(`Test "${deleted.title}" deleted.`, 'info');
		}
	}

	handleDeleteSubject(id: string) {
		const targetSubject = this.subjects.get(id);
		if (!targetSubject) return;

		const fallbackId =
			this.subjects.subjects.find((s) => s.id !== id)?.id || DEFAULT_SUBJECT_IDS.GENERAL;

		// Reassign affected tests using domain method
		this.tests.reassignSubject(id, fallbackId);

		// Reset filter if currently filtering on this deleted subject
		if (
			this.filter.selectedCategory === id ||
			this.filter.selectedCategory === targetSubject.name
		) {
			this.filter.setCategory('All');
		}

		this.subjects.deleteSubject(id);
		this.toast.show(`Subject "${targetSubject.name}" deleted.`, 'info');
	}

	handleClearAllTests() {
		this.tests.clearAll();
		this.attempts.clearAll();
		this.folders.rebuildIndices([]);
		this.modals.closeDetails();
		this.toast.show('All tests cleared.', 'warning');
	}

	openSimilarPaperModal(test: TestItem): void {
		this.modals.openSimilarPaperModal(test);
	}

	async handleCreateSimilarPaperJob(payload: {
		sourceTest: TestItem;
		folderId?: string | null;
		questionCount: number;
		durationMinutes: number | null;
		autoDuration?: boolean;
		isUntimed: boolean;
		customInstructions?: string;
		aiProvider: AIProvider;
		aiModel: string;
	}): Promise<void> {
		if (!this.network.isOnline) {
			this.toast.show(
				'You are offline. Similar paper generation requires an internet connection.',
				'error'
			);
			return;
		}

		await this.queue.enqueueSimilarPaper(payload.sourceTest, {
			folderId: payload.folderId,
			questionCount: payload.questionCount,
			durationMinutes: payload.durationMinutes,
			autoDuration: payload.autoDuration,
			isUntimed: payload.isUntimed,
			customInstructions: payload.customInstructions,
			aiProvider: payload.aiProvider,
			aiModel: payload.aiModel,
		});

		this.toast.show('Similar paper generation queued', 'success');
		this.modals.closeSimilarPaperModal(true);
	}

	private pendingFolderDeleteCommit: (() => Promise<void>) | null = null;
	private commitTimeout: ReturnType<typeof setTimeout> | null = null;

	async moveTestToFolder(testId: string, folderId: string | null): Promise<void> {
		const targetTest = this.tests.tests.find((t) => t.id === testId);
		if (!targetTest) return;
		const oldFolderId = targetTest.folderId ?? null;
		if (oldFolderId === folderId) return;

		const now = new Date().toISOString();
		targetTest.folderId = folderId;
		targetTest.updatedAt = now;
		this.folders.moveTestInIndex(testId, oldFolderId, folderId);
		fireAndForget(
			db.updateTest(testId, { folderId, updatedAt: now }),
			`Moving test "${testId}" to folder "${folderId}"`
		);
		fireAndForget(
			trySupabaseOrQueue(
				async () =>
					supabase.from('tests').update({ folder_id: folderId, updated_at: now }).eq('id', testId),
				{
					table: 'tests',
					action: 'update',
					recordId: testId,
					data: { ...targetTest, folderId, updatedAt: now },
				}
			),
			`Syncing moved test "${testId}" to Supabase`
		);
		const folderName = folderId ? (this.folders.folderMap.get(folderId)?.name ?? 'Folder') : 'Root';
		this.toast.show(`Moved "${targetTest.title}" to ${folderName}.`, 'success');
	}

	async bulkMoveTestsToFolder(testIds: string[], folderId: string | null): Promise<void> {
		if (testIds.length === 0) return;
		const targetFolderName = folderId
			? (this.folders.folderMap.get(folderId)?.name ?? 'Folder')
			: 'Root';
		const now = new Date().toISOString();

		for (const id of testIds) {
			const targetTest = this.tests.tests.find((t) => t.id === id);
			if (targetTest) {
				const oldFolderId = targetTest.folderId ?? null;
				targetTest.folderId = folderId;
				targetTest.updatedAt = now;
				this.folders.moveTestInIndex(id, oldFolderId, folderId);
			}
		}

		fireAndForget(
			db.bulkUpdateTestFolder(testIds, folderId),
			`Bulk moving ${testIds.length} tests to folder "${folderId}"`
		);
		fireAndForget(
			trySupabaseOrQueue(
				async () =>
					supabase.from('tests').update({ folder_id: folderId, updated_at: now }).in('id', testIds),
				{
					table: 'tests',
					action: 'update',
					recordId: testIds.join(','),
					data: { folderId, updatedAt: now },
				}
			),
			`Bulk syncing moved tests to Supabase`
		);
		this.toast.show(`Moved ${testIds.length} papers to ${targetFolderName}.`, 'success');
	}

	async deleteFolder(folderId: string): Promise<void> {
		const folder = this.folders.folderMap.get(folderId);
		if (!folder) return;

		// 0. Flush any previously pending folder deletion commit and clear existing commitTimeout immediately
		if (this.commitTimeout) {
			clearTimeout(this.commitTimeout);
			this.commitTimeout = null;
		}
		if (this.pendingFolderDeleteCommit) {
			await this.pendingFolderDeleteCommit();
			this.pendingFolderDeleteCommit = null;
		}

		// 1. Gather all descendant folder IDs and test IDs
		const descendantFolderIds = this.folders.getDescendantIds(folderId);
		const allFolderIdsToDelete = [folderId, ...descendantFolderIds];
		const folderIdSet = new Set(allFolderIdsToDelete);

		const testsToDelete = this.tests.tests.filter((t) => t.folderId && folderIdSet.has(t.folderId));
		const testIdsToDelete = testsToDelete.map((t) => t.id);
		const testIdSet = new Set(testIdsToDelete);

		// 2. Abort/cancel queue jobs (both target folder and similar paper source/result)
		const jobsToDelete: string[] = [];
		for (const job of this.queue.jobsMap.values()) {
			const isTargetFolder = job.folderId && folderIdSet.has(job.folderId);
			const isSourceTest = job.sourceTestId && testIdSet.has(job.sourceTestId);
			const isTargetTest =
				(job.testId && testIdSet.has(job.testId)) ||
				(job.resultTestId && testIdSet.has(job.resultTestId));

			if (isTargetFolder || isSourceTest || isTargetTest) {
				this.queue.cancelJob(job.id);
				jobsToDelete.push(job.id);
			}
		}

		// 3. Snapshot in-memory state for 8s undo
		const deletedFolders = this.folders.folders.filter((f) => folderIdSet.has(f.id));
		const deletedTests = [...testsToDelete];
		const deletedAttempts = this.attempts.attempts.filter((a) => testIdSet.has(a.testId));
		const previousActiveFolderId = this.folders.activeFolderId;
		const deletedDocAssets = new Map<string, PdfExtractionResult>();
		for (const id of testIdsToDelete) {
			const asset = this.tests.docAssetsCache.get(id);
			if (asset) deletedDocAssets.set(id, asset);
		}

		// 4. Update in-memory stores and indices
		this.isDeletingFolder = true;
		this.folders.folders = this.folders.folders.filter((f) => !folderIdSet.has(f.id));
		this.tests.tests = this.tests.tests.filter((t) => !testIdSet.has(t.id));
		for (const id of testIdsToDelete) {
			this.tests.docAssetsCache.delete(id);
		}
		this.attempts.attempts = this.attempts.attempts.filter((a) => !testIdSet.has(a.testId));
		this.folders.rebuildIndices(this.tests.tests);

		// 5. Repoint activeFolderId if viewing deleted subtree
		if (this.folders.activeFolderId && folderIdSet.has(this.folders.activeFolderId)) {
			const parentId = folder.parentFolderId;
			const safeParentId = parentId && !folderIdSet.has(parentId) ? parentId : null;
			this.folders.setActiveFolder(safeParentId);
			goto(safeParentId ? `?folder=${safeParentId}` : '/', { replaceState: true }).finally(() => {
				this.isDeletingFolder = false;
			});
		} else {
			this.isDeletingFolder = false;
		}

		// 6. Schedule atomic Dexie transaction across all 6 tables with 8-second Undo Toast
		let isUndone = false;

		const commitPermanentDelete = async () => {
			if (isUndone) return;
			if (this.commitTimeout) {
				clearTimeout(this.commitTimeout);
				this.commitTimeout = null;
			}
			this.pendingFolderDeleteCommit = null;
			try {
				await db.atomicCascadeDeleteFolder(allFolderIdsToDelete, testIdsToDelete, jobsToDelete);
			} catch (err) {
				console.error('[AppStore] Failed cascade delete in Dexie:', err);
			}

			// Fire-and-forget Supabase cascade deletions
			for (const fid of allFolderIdsToDelete) {
				fireAndForget(
					trySupabaseOrQueue(async () => supabase.from('folders').delete().eq('id', fid), {
						table: 'folders',
						action: 'delete',
						recordId: fid,
						data: null,
					}),
					`Deleting folder "${fid}" from Supabase`
				);
			}
			for (const tid of testIdsToDelete) {
				fireAndForget(
					trySupabaseOrQueue(async () => supabase.from('tests').delete().eq('id', tid), {
						table: 'tests',
						action: 'delete',
						recordId: tid,
						data: null,
					}),
					`Deleting test "${tid}" from Supabase`
				);
			}
		};

		this.pendingFolderDeleteCommit = commitPermanentDelete;
		this.commitTimeout = setTimeout(commitPermanentDelete, 8000);

		this.toast.show(
			`Deleted folder "${folder.name}" (${testsToDelete.length} ${testsToDelete.length === 1 ? 'paper' : 'papers'}).`,
			'info',
			8000,
			{
				label: 'UNDO',
				onClick: () => {
					isUndone = true;
					if (this.commitTimeout) {
						clearTimeout(this.commitTimeout);
						this.commitTimeout = null;
					}
					this.pendingFolderDeleteCommit = null;

					// Restore in-memory state
					this.folders.folders = [...this.folders.folders, ...deletedFolders];
					this.tests.tests = [...this.tests.tests, ...deletedTests];
					for (const [id, asset] of deletedDocAssets) {
						this.tests.docAssetsCache.set(id, asset);
					}
					for (const attempt of deletedAttempts) {
						if (!this.attempts.attempts.some((a) => a.id === attempt.id)) {
							this.attempts.attempts = [...this.attempts.attempts, attempt];
						}
					}
					this.folders.setActiveFolder(previousActiveFolderId);
					this.folders.rebuildIndices(this.tests.tests);
					if (previousActiveFolderId) {
						goto(`?folder=${previousActiveFolderId}`, { replaceState: true });
					} else {
						goto('/', { replaceState: true });
					}

					// Re-persist restored items back to Dexie so that if a commit occurred or after page reload, the restored entities are never lost
					fireAndForget(db.bulkSaveFolders(deletedFolders), 'Restoring undone folders to Dexie');
					fireAndForget(db.bulkSaveTests(deletedTests), 'Restoring undone tests to Dexie');
					if (deletedAttempts.length > 0) {
						fireAndForget(
							db.bulkSaveAttempts(deletedAttempts),
							'Restoring undone attempts to Dexie'
						);
					}

					// Restore to Supabase
					for (const f of deletedFolders) {
						fireAndForget(
							trySupabaseOrQueue(
								async () =>
									supabase.from('folders').upsert({
										id: f.id,
										name: f.name,
										parent_folder_id: f.parentFolderId || null,
										color: f.color,
										icon: f.icon || null,
										order_index: f.order,
										created_at: f.createdAt,
										updated_at: f.updatedAt || new Date().toISOString(),
									}),
								{ table: 'folders', action: 'create', recordId: f.id, data: f }
							),
							`Restoring folder "${f.name}" to Supabase`
						);
					}
					for (const t of deletedTests) {
						fireAndForget(
							this.tests.syncTestToCloud(t, 'create'),
							`Restoring test "${t.title}" to Supabase`
						);
					}

					this.toast.show(`Restored folder "${folder.name}".`, 'success');
				},
			}
		);
	}
}

/**
 * Provide AppStore via SvelteKit Context (Client-isolated)
 */
export function setAppContext(store: AppStore) {
	return setContext(APP_CONTEXT_KEY, store);
}

/**
 * Retrieve AppStore from SvelteKit Context
 */
export function getAppContext(): AppStore {
	const store = getContext<AppStore>(APP_CONTEXT_KEY);
	if (!store) {
		throw new Error(
			'AppStore not found in Svelte context. Ensure setAppContext is called in +layout.svelte.'
		);
	}
	return store;
}
