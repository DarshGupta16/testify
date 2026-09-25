import { db } from '$lib/services/db';
import { supabase } from '$lib/services/supabase/client';
import type { AppStore } from '$lib/stores/appContext.svelte';
import type { AIProvider, SecurityMode, StoredApiKeyRecord } from '$lib/types/apiKeys';
import { rowToAttempt, rowToFolder, rowToSubject, rowToTest } from './mappers';

const LAST_SYNC_KEY = 'last_supabase_sync_time';

/**
 * Performs an incremental delta sync, pulling records updated in Supabase
 * since the last recorded sync time, reconciling with Dexie and active in-memory stores.
 */
export async function supabaseDeltaSync(app?: AppStore): Promise<void> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) {
		return;
	}

	try {
		const lastSyncTime = await db.getSetting<string>(LAST_SYNC_KEY, '1970-01-01T00:00:00.000Z');
		const syncStartTime = new Date().toISOString();

		// Fetch delta across all collections in parallel
		const [testsRes, foldersRes, subjectsRes, attemptsRes, settingsRes, apiKeysRes] =
			await Promise.all([
				supabase.from('tests').select('*').gt('updated_at', lastSyncTime),
				supabase.from('folders').select('*').gt('updated_at', lastSyncTime),
				supabase.from('subjects').select('*').gt('updated_at', lastSyncTime),
				supabase.from('attempts').select('*').gt('updated_at', lastSyncTime),
				supabase.from('settings').select('*').gt('updated_at', lastSyncTime),
				supabase.from('synced_api_keys').select('*').gt('updated_at', lastSyncTime),
			]);

		const remoteTests = testsRes.data || [];
		const remoteFolders = foldersRes.data || [];
		const remoteSubjects = subjectsRes.data || [];
		const remoteAttempts = attemptsRes.data || [];
		const remoteSettings = settingsRes.data || [];
		const remoteApiKeys = apiKeysRes.data || [];

		if (
			remoteTests.length === 0 &&
			remoteFolders.length === 0 &&
			remoteSubjects.length === 0 &&
			remoteAttempts.length === 0 &&
			remoteSettings.length === 0 &&
			remoteApiKeys.length === 0
		) {
			await db.setSetting(LAST_SYNC_KEY, syncStartTime);
			return;
		}

		console.info(
			`[Delta Sync] Fetched changes: ${remoteTests.length} tests, ${remoteFolders.length} folders, ${remoteSubjects.length} subjects, ${remoteAttempts.length} attempts, ${remoteApiKeys.length} api keys.`
		);

		// Map to domain items using shared mappers
		const mappedTests = remoteTests.map(rowToTest);
		const mappedFolders = remoteFolders.map(rowToFolder);
		const mappedSubjects = remoteSubjects.map(rowToSubject);
		const mappedAttempts = remoteAttempts.map(rowToAttempt);

		const mappedApiKeys: StoredApiKeyRecord[] = remoteApiKeys.map((row) => ({
			provider: row.provider as AIProvider,
			securityMode: (row.security_mode as SecurityMode) || 'strict',
			isEncrypted: true,
			ciphertext: row.ciphertext,
			iv: row.iv,
			salt: row.salt,
			updatedAt: row.updated_at,
		}));

		// Persist delta into Dexie
		await db.transaction(
			'rw',
			[db.tests, db.folders, db.subjects, db.attempts, db.settings, db.apiKeys],
			async () => {
				if (mappedTests.length > 0) await db.tests.bulkPut(mappedTests);
				if (mappedFolders.length > 0) await db.folders.bulkPut(mappedFolders);
				if (mappedSubjects.length > 0) await db.subjects.bulkPut(mappedSubjects);
				if (mappedAttempts.length > 0) await db.attempts.bulkPut(mappedAttempts);
				if (mappedApiKeys.length > 0) await db.apiKeys.bulkPut(mappedApiKeys);
				for (const setting of remoteSettings) {
					await db.settings.put({
						key: setting.key,
						value: setting.value,
						updatedAt: setting.updated_at,
					});
				}
				await db.settings.put({
					key: LAST_SYNC_KEY,
					value: syncStartTime,
					updatedAt: syncStartTime,
				});
			}
		);

		// Reconcile into active in-memory stores if app context was provided
		if (app) {
			if (mappedFolders.length > 0) {
				const existingMap = new Map(app.folders.folders.map((f) => [f.id, f]));
				for (const f of mappedFolders) existingMap.set(f.id, f);
				app.folders.folders = Array.from(existingMap.values());
			}

			if (mappedSubjects.length > 0) {
				const existingMap = new Map(app.subjects.subjects.map((s) => [s.id, s]));
				for (const s of mappedSubjects) existingMap.set(s.id, s);
				app.subjects.subjects = Array.from(existingMap.values());
			}

			if (mappedTests.length > 0) {
				const existingMap = new Map(app.tests.tests.map((t) => [t.id, t]));
				for (const t of mappedTests) existingMap.set(t.id, t);
				app.tests.tests = Array.from(existingMap.values());
			}

			if (mappedAttempts.length > 0) {
				const existingMap = new Map(app.attempts.attempts.map((a) => [a.id, a]));
				for (const a of mappedAttempts) existingMap.set(a.id, a);
				app.attempts.attempts = Array.from(existingMap.values());
			}

			if (mappedApiKeys.length > 0) {
				await app.apiKeys.init(app.security.securityMode);
			}

			if (mappedTests.length > 0 || mappedFolders.length > 0) {
				app.folders.rebuildIndices(app.tests.tests);
			}
		}
	} catch (err) {
		console.error('[Delta Sync] Failed to run delta sync:', err);
	}
}
