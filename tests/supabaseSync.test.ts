import { describe, expect, it } from 'bun:test';
import { db } from '$lib/services/db';
import { isSupabaseConfigured, supabase } from '$lib/services/supabase/client';
import {
	attemptToRow,
	folderToRow,
	rowToAttempt,
	rowToFolder,
	rowToSubject,
	rowToTest,
	subjectToRow,
	testToRow,
} from '$lib/services/supabase/sync/mappers';
import { trySupabaseOrQueue } from '$lib/services/supabase/sync/trySupabaseOrQueue';
import { ApiKeyStore } from '$lib/stores/apiKeyStore.svelte';
import { AuthStore } from '$lib/stores/authStore.svelte';
import { SecurityStore } from '$lib/stores/securityStore.svelte';
import { SettingsStore } from '$lib/stores/settingsStore.svelte';
import type { FolderItem } from '$lib/types/folder';
import type { SubjectItem } from '$lib/types/subject';
import { createDefaultSubjects } from '$lib/types/subject';
import type { TestAttempt, TestItem } from '$lib/types/test';

describe('Supabase Sync & Offline Operations', () => {
	it('safe dummy client allows evaluation and queries without throwing Invalid URL', async () => {
		expect(typeof isSupabaseConfigured).toBe('boolean');
		expect(supabase).toBeDefined();

		const sessionRes = await supabase.auth.getSession();
		expect(sessionRes.data.session).toBeNull();
		expect(sessionRes.error).toBeNull();

		const queryRes = await supabase.from('tests').select('*');
		expect(queryRes).toBeDefined();
	});

	it('trySupabaseOrQueue succeeds and returns result when online', async () => {
		let operationExecuted = false;
		await trySupabaseOrQueue(
			async () => {
				operationExecuted = true;
				return { data: { id: 'test-123' }, error: null };
			},
			{
				table: 'tests',
				action: 'create',
				recordId: 'test-123',
				data: { id: 'test-123', title: 'Test 1' },
			}
		);

		expect(operationExecuted).toBe(true);
	});

	it('trySupabaseOrQueue catches network errors and gracefully falls back to offline queue', async () => {
		let queuedOp: any = null;
		const originalAddOfflineOp = db.addOfflineOp;
		db.addOfflineOp = async (op) => {
			queuedOp = op;
			return 1;
		};

		try {
			await trySupabaseOrQueue(
				async () => {
					throw new TypeError('Failed to fetch');
				},
				{
					table: 'tests',
					action: 'update',
					recordId: 'test-456',
					data: { id: 'test-456', title: 'Offline Test' },
				}
			);

			expect(queuedOp).toBeDefined();
			expect(queuedOp?.recordId).toBe('test-456');
		} finally {
			db.addOfflineOp = originalAddOfflineOp;
		}
	});

	it('trySupabaseOrQueue does NOT queue non-transient 4xx errors (400, 401, 403, 409, 422)', async () => {
		let queuedCount = 0;
		const originalAddOfflineOp = db.addOfflineOp;
		db.addOfflineOp = async () => {
			queuedCount++;
			return 1;
		};

		try {
			const clientErrorCodes = [400, 401, 403, 404, 409, 422];
			for (const status of clientErrorCodes) {
				await trySupabaseOrQueue(
					async () => ({
						data: null,
						error: { message: `Client error with status ${status}`, code: 'PGRST_ERR' },
						status,
					}),
					{
						table: 'tests',
						action: 'create',
						recordId: `err-${status}`,
						data: { id: `err-${status}` },
					}
				);
			}

			expect(queuedCount).toBe(0);
		} finally {
			db.addOfflineOp = originalAddOfflineOp;
		}
	});

	it('trySupabaseOrQueue queues transient 5xx errors and status === 0', async () => {
		const queuedOps: any[] = [];
		const originalAddOfflineOp = db.addOfflineOp;
		db.addOfflineOp = async (op) => {
			queuedOps.push(op);
			return 1;
		};

		try {
			// Status 500
			await trySupabaseOrQueue(
				async () => ({
					data: null,
					error: { message: 'Internal Server Error', code: '500' },
					status: 500,
				}),
				{
					table: 'tests',
					action: 'update',
					recordId: 'rec-500',
					data: { id: 'rec-500' },
				}
			);

			// Status 0
			await trySupabaseOrQueue(
				async () => ({
					data: null,
					error: { message: 'Network connection dropped', code: '0' },
					status: 0,
				}),
				{
					table: 'tests',
					action: 'update',
					recordId: 'rec-0',
					data: { id: 'rec-0' },
				}
			);

			expect(queuedOps.length).toBe(2);
			expect(queuedOps[0].recordId).toBe('rec-500');
			expect(queuedOps[1].recordId).toBe('rec-0');
		} finally {
			db.addOfflineOp = originalAddOfflineOp;
		}
	});

	it('AuthStore initializes with guest/unauthenticated state and handles logout cleanly', () => {
		const auth = new AuthStore();
		expect(auth.isAuthenticated).toBe(false);
		expect(auth.user).toBeNull();
		expect(auth.syncStatus).toBe('idle');
		expect(auth.showDeviceSyncPrompt).toBe(false);
	});

	it('mappers correctly perform bi-directional transformations', () => {
		// Test Item
		const testDomain: TestItem = {
			id: 'test-1',
			title: 'Math Test',
			description: 'Algebra Basics',
			subjectId: 'sub-1',
			folderId: 'fold-1',
			durationMinutes: 45,
			totalMarks: 100,
			testFileName: 'math.pdf',
			testFileSizeFormatted: '2 MB',
			status: 'ready',
			questions: [],
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-02T00:00:00.000Z',
		};

		const testRow = testToRow(testDomain, 'user-xyz');
		expect(testRow.id).toBe('test-1');
		expect(testRow.user_id).toBe('user-xyz');
		expect(testRow.subject_id).toBe('sub-1');
		expect(testRow.folder_id).toBe('fold-1');

		const backToTest = rowToTest({
			...testRow,
			ai_model: null,
			ai_provider: null,
			answer_key_file_name: null,
			answer_key_file_size_formatted: null,
			blueprint: null,
			token_usage: null,
			user_id: 'user-xyz',
		} as any);
		expect(backToTest.id).toBe(testDomain.id);
		expect(backToTest.title).toBe(testDomain.title);
		expect(backToTest.folderId).toBe('fold-1');

		// Folder Item
		const folderDomain: FolderItem = {
			id: 'fold-1',
			name: 'Physics',
			parentFolderId: null,
			order: 0,
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-02T00:00:00.000Z',
		};
		const folderRow = folderToRow(folderDomain, 'user-xyz');
		expect(folderRow.name).toBe('Physics');
		const backToFolder = rowToFolder({ ...folderRow, user_id: 'user-xyz' } as any);
		expect(backToFolder.id).toBe(folderDomain.id);
		expect(backToFolder.name).toBe('Physics');

		// Subject Item
		const subjectDomain: SubjectItem = {
			id: 'sub-1',
			name: 'Chemistry',
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-02T00:00:00.000Z',
		};
		const subjectRow = subjectToRow(subjectDomain, 'user-xyz');
		expect(subjectRow.name).toBe('Chemistry');
		const backToSubject = rowToSubject({ ...subjectRow, user_id: 'user-xyz' } as any);
		expect(backToSubject.id).toBe(subjectDomain.id);
		expect(backToSubject.name).toBe('Chemistry');

		// Attempt Item
		const attemptDomain: TestAttempt = {
			id: 'att-1',
			testId: 'test-1',
			testTitle: 'Math Test',
			startedAt: '2026-01-01T00:00:00.000Z',
			durationSecondsTaken: 1200,
			mode: 'exam',
			status: 'completed',
			responses: {},
			score: 85,
			maxPossibleScore: 100,
			accuracyPercentage: 85,
			totalQuestions: 25,
			answeredCount: 25,
			correctCount: 22,
			incorrectCount: 3,
			unattemptedCount: 0,
			reviewCount: 0,
			updatedAt: '2026-01-01T01:00:00.000Z',
		};
		const attemptRow = attemptToRow(attemptDomain, 'user-xyz');
		expect(attemptRow.score).toBe(85);
		const backToAttempt = rowToAttempt({ ...attemptRow, user_id: 'user-xyz' } as any);
		expect(backToAttempt.id).toBe(attemptDomain.id);
		expect(backToAttempt.score).toBe(85);
	});

	it('createDefaultSubjects generates unique non-colliding UUIDs', () => {
		const set1 = createDefaultSubjects();
		const set2 = createDefaultSubjects();

		expect(set1.length).toBe(5);
		expect(set2.length).toBe(5);

		// Distinct IDs across sets
		for (let i = 0; i < set1.length; i++) {
			expect(set1[i].id).not.toBe(set2[i].id);
		}
	});

	it('SettingsStore guards cloud sync with app.auth.isAuthenticated', async () => {
		let syncInvoked = false;
		// Spy on supabase.from('settings').upsert
		const originalFrom = supabase.from;
		(supabase as any).from = (table: string) => {
			if (table === 'settings') {
				syncInvoked = true;
			}
			return (originalFrom as any).call(supabase, table);
		};

		try {
			// Case 1: Guest (unauthenticated)
			const guestSettings = new SettingsStore({ auth: { isAuthenticated: false } });
			syncInvoked = false;
			guestSettings.setDefaultDurationMinutes(120);
			// Allow microtask queue to run
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(syncInvoked).toBe(false);

			// Case 2: Authenticated user
			const authSettings = new SettingsStore({ auth: { isAuthenticated: true } });
			syncInvoked = false;
			authSettings.setDefaultDurationMinutes(90);
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(syncInvoked).toBe(true);
		} finally {
			supabase.from = originalFrom;
		}
	});

	it('Canary token verification prevents vacuous unlock in Strict Mode with 0 API keys', async () => {
		const mockStorage: Record<string, any> = {};
		const mockDb: any = {
			getAllApiKeys: async () => [],
			getSetting: async (key: string, defaultVal: any) => mockStorage[key] ?? defaultVal,
			setSetting: async (key: string, val: any) => {
				mockStorage[key] = val;
			},
			saveApiKeyRecord: async () => {},
			clearAllApiKeys: async () => {},
		};

		const security = new SecurityStore(mockDb);
		const apiKeys = new ApiKeyStore(mockDb);

		// Activate Strict mode with master password
		await security.setMasterPassword('SuperSecret123!');
		expect(mockStorage['testify_canary_token']).toBeDefined();

		// 1. Decrypting with correct password succeeds
		let decryptSucceeded = false;
		try {
			await apiKeys.decryptAllKeys('SuperSecret123!');
			decryptSucceeded = true;
		} catch {
			decryptSucceeded = false;
		}
		expect(decryptSucceeded).toBe(true);

		// 2. Decrypting with wrong password throws error and prevents vacuous unlock
		let errorThrown = false;
		try {
			await apiKeys.decryptAllKeys('WrongPassword999!');
		} catch {
			errorThrown = true;
		}
		expect(errorThrown).toBe(true);

		// 3. SecurityStore.verifyCanary directly validates password
		expect(await security.verifyCanary('SuperSecret123!')).toBe(true);
		expect(await security.verifyCanary('WrongPassword999!')).toBe(false);
	});
});
