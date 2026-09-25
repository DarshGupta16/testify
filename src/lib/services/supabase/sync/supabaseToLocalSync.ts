import { db } from '$lib/services/db';
import { supabase } from '$lib/services/supabase/client';
import type { AppStore } from '$lib/stores/appContext.svelte';
import type { AIProvider, SecurityMode, StoredApiKeyRecord } from '$lib/types/apiKeys';
import { rowToAttempt, rowToFolder, rowToSubject, rowToTest } from './mappers';

const LAST_SYNC_KEY = 'last_supabase_sync_time';

/**
 * Performs a complete initial cloud pull from Supabase for all user records,
 * populating Dexie and updating active in-memory stores.
 */
export async function supabaseToLocalSync(app?: AppStore): Promise<void> {
	try {
		const syncStartTime = new Date().toISOString();

		const [testsRes, foldersRes, subjectsRes, attemptsRes, settingsRes, apiKeysRes] =
			await Promise.all([
				supabase.from('tests').select('*'),
				supabase.from('folders').select('*'),
				supabase.from('subjects').select('*'),
				supabase.from('attempts').select('*'),
				supabase.from('settings').select('*'),
				supabase.from('synced_api_keys').select('*'),
			]);

		const mappedTests = (testsRes.data || []).map(rowToTest);
		const mappedFolders = (foldersRes.data || []).map(rowToFolder);
		const mappedSubjects = (subjectsRes.data || []).map(rowToSubject);
		const mappedAttempts = (attemptsRes.data || []).map(rowToAttempt);
		const remoteSettings = settingsRes.data || [];
		const remoteApiKeys = apiKeysRes.data || [];

		const mappedApiKeys: StoredApiKeyRecord[] = remoteApiKeys.map((row) => ({
			provider: row.provider as AIProvider,
			securityMode: (row.security_mode as SecurityMode) || 'strict',
			isEncrypted: true,
			ciphertext: row.ciphertext,
			iv: row.iv,
			salt: row.salt,
			updatedAt: row.updated_at,
		}));

		// Persist into Dexie
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

		// Hydrate in-memory stores if provided
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

			app.folders.rebuildIndices(app.tests.tests);
		}
	} catch (err) {
		console.error('[Full Sync] Failed pulling remote data:', err);
		throw err;
	}
}
