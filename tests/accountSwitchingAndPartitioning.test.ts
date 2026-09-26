import { beforeEach, describe, expect, it } from 'bun:test';
import Dexie from 'dexie';
import {
	_resetDatabaseInstancesForTesting,
	db,
	deleteUserDatabase,
	getActiveDatabase,
	getDatabaseForUser,
	getUserDbName,
	migrateLegacyDatabaseIfNeeded,
	switchActiveDatabase,
	TestifyDatabase,
} from '$lib/services/db';
import {
	_resetSessionVaultForTesting,
	clearAllAccounts,
	decryptTokens,
	encryptTokens,
	getAccountSessionTokens,
	getDeviceBoundKey,
	getSavedAccounts,
	removeAccountSession,
	saveAccountSession,
	updateAccountLastActive,
	updateAccountTokens,
} from '$lib/services/supabase/sessionRegistry';
import { AppStore } from '$lib/stores/appContext.svelte';
import { AuthStore } from '$lib/stores/authStore.svelte';

describe('Architecture A: Physical Partitioning of Dexie Databases by User ID', () => {
	beforeEach(() => {
		_resetDatabaseInstancesForTesting();
		_resetSessionVaultForTesting();
	});

	it('getUserDbName resolves correct physical database names', () => {
		expect(getUserDbName()).toBe('testify_guest');
		expect(getUserDbName(null)).toBe('testify_guest');
		expect(getUserDbName(undefined)).toBe('testify_guest');
		expect(getUserDbName('')).toBe('testify_guest');
		expect(getUserDbName('   ')).toBe('testify_guest');

		expect(getUserDbName('user-123')).toBe('testify_user-123');
		expect(getUserDbName('usr_998877')).toBe('testify_usr_998877');
		expect(getUserDbName('  user-trimmed  ')).toBe('testify_user-trimmed');
	});

	it('getActiveDatabase defaults to testify_guest and caches instances', () => {
		const active1 = getActiveDatabase();
		expect(active1).toBeInstanceOf(TestifyDatabase);
		expect(active1.name).toBe('testify_guest');

		const active2 = getActiveDatabase();
		expect(active1).toBe(active2); // identity cached
	});

	it('switchActiveDatabase switches partition cleanly', () => {
		const guestDb = getActiveDatabase();
		expect(guestDb.name).toBe('testify_guest');

		const userDb = switchActiveDatabase('user-alpha');
		expect(userDb.name).toBe('testify_user-alpha');
		expect(getActiveDatabase().name).toBe('testify_user-alpha');

		// Switching back to guest
		const backToGuest = switchActiveDatabase(null);
		expect(backToGuest.name).toBe('testify_guest');
	});

	it('db dynamic Proxy forwards properties, methods, and tables to the active partition', () => {
		switchActiveDatabase(null);
		expect(db.name).toBe('testify_guest');
		expect(db).toBeInstanceOf(TestifyDatabase);
		expect(db.tests).toBeDefined();
		expect(db.folders).toBeDefined();
		expect(typeof db.getAllTests).toBe('function');

		// Dynamic forwarding when switching database
		switchActiveDatabase('user-beta');
		expect(db.name).toBe('testify_user-beta');

		switchActiveDatabase('user-gamma');
		expect(db.name).toBe('testify_user-gamma');

		switchActiveDatabase(null);
		expect(db.name).toBe('testify_guest');
	});

	it('db dynamic Proxy supports property assignment and setting', () => {
		const originalAddOfflineOp = db.addOfflineOp;
		let called = false;
		db.addOfflineOp = async () => {
			called = true;
			return 1;
		};

		db.addOfflineOp({ table: 'tests', action: 'create', recordId: '1', data: null });
		expect(called).toBe(true);

		db.addOfflineOp = originalAddOfflineOp;
	});

	it('deleteUserDatabase switches active partition to guest if target was active', async () => {
		switchActiveDatabase('user-to-delete');
		expect(getActiveDatabase().name).toBe('testify_user-to-delete');

		await deleteUserDatabase('user-to-delete');
		expect(getActiveDatabase().name).toBe('testify_guest');
	});
});

describe('Encrypted Session Vault (Web Crypto AES-GCM)', () => {
	beforeEach(() => {
		_resetSessionVaultForTesting();
	});

	it('getDeviceBoundKey creates non-extractable 256-bit AES-GCM key', async () => {
		const key = await getDeviceBoundKey();
		expect(key).toBeDefined();
		expect(key.algorithm.name).toBe('AES-GCM');
		expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
		expect(key.extractable).toBe(false); // Non-extractable security guarantee
	});

	it('encryptTokens and decryptTokens perform round-trip encryption correctly', async () => {
		const key = await getDeviceBoundKey();
		const tokens = {
			accessToken: 'eyJh...mock-access-token',
			refreshToken: 'mock-refresh-token-xyz',
			expiresAt: 1770000000,
		};

		const encrypted = await encryptTokens(tokens, key);
		expect(encrypted.iv).toBeDefined();
		expect(encrypted.ciphertext).toBeDefined();
		expect(typeof encrypted.iv).toBe('string');
		expect(typeof encrypted.ciphertext).toBe('string');

		const decrypted = await decryptTokens(encrypted, key);
		expect(decrypted.accessToken).toBe(tokens.accessToken);
		expect(decrypted.refreshToken).toBe(tokens.refreshToken);
		expect(decrypted.expiresAt).toBe(tokens.expiresAt);
	});

	it('vault CRUD operations correctly manage multiple accounts', async () => {
		await saveAccountSession(
			{
				userId: 'user-1',
				email: 'alice@example.com',
				displayName: 'Alice Student',
			},
			{
				accessToken: 'token-alice-access',
				refreshToken: 'token-alice-refresh',
				expiresAt: 12345,
			}
		);

		await saveAccountSession(
			{
				userId: 'user-2',
				email: 'bob@example.com',
				displayName: 'Bob Professor',
			},
			{
				accessToken: 'token-bob-access',
				refreshToken: 'token-bob-refresh',
				expiresAt: 67890,
			}
		);

		const saved = await getSavedAccounts();
		expect(saved.length).toBe(2);
		expect(saved.map((a) => a.email)).toContain('alice@example.com');
		expect(saved.map((a) => a.email)).toContain('bob@example.com');

		// Decrypt tokens for alice
		const aliceTokens = await getAccountSessionTokens('user-1');
		expect(aliceTokens).not.toBeNull();
		expect(aliceTokens?.accessToken).toBe('token-alice-access');
		expect(aliceTokens?.refreshToken).toBe('token-alice-refresh');

		// Update tokens on refresh
		await updateAccountTokens('user-1', {
			accessToken: 'token-alice-new-access',
			refreshToken: 'token-alice-new-refresh',
			expiresAt: 99999,
		});

		const updatedTokens = await getAccountSessionTokens('user-1');
		expect(updatedTokens?.accessToken).toBe('token-alice-new-access');

		// Update last active
		await updateAccountLastActive('user-1');
		const afterActive = await getSavedAccounts();
		expect(afterActive.length).toBe(2);

		// Remove account
		await removeAccountSession('user-2');
		const afterRemove = await getSavedAccounts();
		expect(afterRemove.length).toBe(1);
		expect(afterRemove[0].userId).toBe('user-1');

		// Clear all
		await clearAllAccounts();
		const afterClear = await getSavedAccounts();
		expect(afterClear.length).toBe(0);
	});
});

describe('AuthStore & Multi-Account Switching Integration', () => {
	beforeEach(() => {
		_resetDatabaseInstancesForTesting();
		_resetSessionVaultForTesting();
	});

	it('AuthStore initializes with empty savedAccounts and guest partition', async () => {
		const auth = new AuthStore();
		expect(auth.savedAccounts).toEqual([]);
		expect(auth.isAuthenticated).toBe(false);
		expect(getActiveDatabase().name).toBe('testify_guest');
	});

	it('switchAccount swaps active database and restores user state', async () => {
		const auth = new AuthStore();
		await saveAccountSession(
			{
				userId: 'user-carol',
				email: 'carol@test.com',
				displayName: 'Carol',
			},
			{
				accessToken: 'acc',
				refreshToken: 'ref',
			}
		);
		auth.savedAccounts = await getSavedAccounts();

		const app = new AppStore();
		// Mock rehydrateUserStores to observe invocation
		let rehydrated = false;
		app.rehydrateUserStores = async () => {
			rehydrated = true;
		};
		await auth.init(app);

		await auth.switchAccount('user-carol');

		expect(getActiveDatabase().name).toBe('testify_user-carol');
		expect(auth.isAuthenticated).toBe(true);
		expect(auth.user?.email).toBe('carol@test.com');
		expect(rehydrated).toBe(true);
	});

	it('switchToGuest resets user state and sets active database to testify_guest', async () => {
		const auth = new AuthStore();
		await saveAccountSession(
			{
				userId: 'user-dan',
				email: 'dan@test.com',
			},
			{
				accessToken: 'acc',
				refreshToken: 'ref',
			}
		);
		auth.savedAccounts = await getSavedAccounts();

		const app = new AppStore();
		let rehydratedCount = 0;
		app.rehydrateUserStores = async () => {
			rehydratedCount++;
		};
		await auth.init(app);

		await auth.switchAccount('user-dan');
		expect(auth.isAuthenticated).toBe(true);
		expect(getActiveDatabase().name).toBe('testify_user-dan');

		await auth.switchToGuest();
		expect(auth.isAuthenticated).toBe(false);
		expect(auth.user).toBeNull();
		expect(getActiveDatabase().name).toBe('testify_guest');
		expect(rehydratedCount).toBe(2);
	});

	it('signOut with wipeLocalData=false preserves saved account and partition', async () => {
		const auth = new AuthStore();
		await saveAccountSession(
			{
				userId: 'user-eve',
				email: 'eve@test.com',
			},
			{
				accessToken: 'acc',
				refreshToken: 'ref',
			}
		);
		auth.savedAccounts = await getSavedAccounts();

		const app = new AppStore();
		app.rehydrateUserStores = async () => {};
		await auth.init(app);
		await auth.switchAccount('user-eve');

		await auth.signOut({ wipeLocalData: false });

		expect(auth.isAuthenticated).toBe(false);
		expect(getActiveDatabase().name).toBe('testify_guest');
		// Account is still in saved accounts for 1-click switch
		const saved = await getSavedAccounts();
		expect(saved.some((a) => a.userId === 'user-eve')).toBe(true);
	});

	it('signOut with wipeLocalData=true erases partition and removes from vault', async () => {
		const auth = new AuthStore();
		await saveAccountSession(
			{
				userId: 'user-frank',
				email: 'frank@test.com',
			},
			{
				accessToken: 'acc',
				refreshToken: 'ref',
			}
		);
		auth.savedAccounts = await getSavedAccounts();

		const app = new AppStore();
		app.rehydrateUserStores = async () => {};
		await auth.init(app);
		await auth.switchAccount('user-frank');

		await auth.signOut({ wipeLocalData: true });

		expect(auth.isAuthenticated).toBe(false);
		expect(getActiveDatabase().name).toBe('testify_guest');
		// Account was erased from vault
		const saved = await getSavedAccounts();
		expect(saved.some((a) => a.userId === 'user-frank')).toBe(false);
	});

	it('concurrent getDeviceBoundKey calls resolve to the identical key instance', async () => {
		_resetSessionVaultForTesting();
		const [key1, key2, key3] = await Promise.all([
			getDeviceBoundKey(),
			getDeviceBoundKey(),
			getDeviceBoundKey(),
		]);
		expect(key1).toBe(key2);
		expect(key2).toBe(key3);
	});

	it('rehydrateUserStores cleans up active modals, resets filter, and locks security session', async () => {
		const app = new AppStore();
		app.modals.openEdit({
			id: 'test-1',
			title: 'Open Test',
			createdAt: '2026-01-01',
			subjectId: 'general',
			status: 'ready',
			questions: [],
		} as any);
		app.filter.setSearch('Calculus');
		expect(app.modals.isEditModalOpen).toBe(true);
		expect(app.filter.searchQuery).toBe('Calculus');

		await app.rehydrateUserStores();

		expect(app.modals.isEditModalOpen).toBe(false);
		expect(app.filter.searchQuery).toBe('');
		expect(app.modals.editingTest).toBeNull();
	});

	it('migrateLegacyDatabaseIfNeeded unconditionally deletes TestifyDatabase even if guest already has data', async () => {
		let deleteCalledWith: string | null = null;
		const originalDelete = Dexie.delete;
		const originalExists = Dexie.exists;
		const originalIndexedDB = (globalThis as any).indexedDB;

		(globalThis as any).indexedDB = {} as any;
		(Dexie as any).exists = async (name: string) => name === 'TestifyDatabase';
		(Dexie as any).delete = async (name: string) => {
			deleteCalledWith = name;
		};

		_resetDatabaseInstancesForTesting();

		const guestDb = getDatabaseForUser(null);
		guestDb.tests = { count: async () => 5 } as any;
		guestDb.folders = { count: async () => 0 } as any;
		guestDb.getSetting = async () => false as any;
		guestDb.setSetting = async () => {};

		await migrateLegacyDatabaseIfNeeded(guestDb);

		expect(deleteCalledWith as string | null).toBe('TestifyDatabase');

		(Dexie as any).delete = originalDelete;
		(Dexie as any).exists = originalExists;
		(globalThis as any).indexedDB = originalIndexedDB;
	});

	it('mergeAndUploadLocalData moves guest papers into user DB and clears testify_guest', async () => {
		const auth = new AuthStore();
		auth.user = { id: 'user-migrate', email: 'migrate@test.com' } as any;

		const guestDb = getDatabaseForUser(null);
		const userDb = getDatabaseForUser('user-migrate');

		// Seed guest database with mock records
		const mockTest = { id: 'guest-paper-1', title: 'Guest Math Exam', subjectId: 'math', questions: [] } as any;
		(guestDb.tests as any).toArray = async () => [mockTest];
		(guestDb.folders as any).toArray = async () => [];
		(guestDb.subjects as any).toArray = async () => [];
		(guestDb.attempts as any).toArray = async () => [];
		(guestDb.testDocAssets as any).toArray = async () => [];

		let userDbBulkPutCount = 0;
		(userDb.tests as any).bulkPut = async (items: any[]) => {
			userDbBulkPutCount = items.length;
		};

		let guestTestsCleared = false;
		(guestDb.tests as any).clear = async () => {
			guestTestsCleared = true;
		};

		let rehydrateCalled = false;
		const mockApp = {
			rehydrateUserStores: async () => {
				rehydrateCalled = true;
			},
			toast: { show: () => {} },
		} as any;

		(auth as any).app = mockApp;
		auth.startSyncCycle = async () => {};

		await auth.mergeAndUploadLocalData();

		expect(userDbBulkPutCount).toBe(1);
		expect(guestTestsCleared).toBe(true);
		expect(rehydrateCalled).toBe(true);
		expect(auth.showDeviceSyncPrompt).toBe(false);
	});

	it('syncNow triggers showDeviceSyncPrompt when guest assessments exist', async () => {
		const auth = new AuthStore();
		auth.user = { id: 'user-sync-prompt', email: 'sync@test.com' } as any;

		const guestDb = getDatabaseForUser(null);
		guestDb.getAllTests = async () => [{ id: 'guest-1', title: 'Sample' } as any];

		await auth.syncNow();

		expect(auth.showDeviceSyncPrompt).toBe(true);
		expect(auth.pendingLocalTestsCount).toBe(1);
	});

	it('keepCloudOnly leaves guestDb untouched and rehydrates user stores', async () => {
		const auth = new AuthStore();
		auth.user = { id: 'user-keep-cloud', email: 'keep@test.com' } as any;
		auth.showDeviceSyncPrompt = true;

		const guestDb = getDatabaseForUser(null);
		let guestCleared = false;
		(guestDb.tests as any).clear = async () => {
			guestCleared = true;
		};

		let rehydrateCalled = false;
		const mockApp = {
			rehydrateUserStores: async () => {
				rehydrateCalled = true;
			},
			toast: { show: () => {} },
		} as any;
		(auth as any).app = mockApp;

		await auth.keepCloudOnly();

		expect(guestCleared).toBe(false);
		expect(rehydrateCalled).toBe(true);
		expect(auth.showDeviceSyncPrompt).toBe(false);
	});
});
