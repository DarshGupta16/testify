import { db } from '$lib/services/db';
import { supabase } from '$lib/services/supabase/client';
import type { AppStore } from '$lib/stores/appContext.svelte';
import type { FolderItem } from '$lib/types/folder';
import type { SubjectItem } from '$lib/types/subject';
import type { TestAttempt, TestItem } from '$lib/types/test';

const LAST_SYNC_KEY = 'last_supabase_sync_time';

/**
 * Performs a complete initial cloud pull from Supabase for all user records,
 * populating Dexie and updating active in-memory stores.
 */
export async function supabaseToLocalSync(app?: AppStore): Promise<void> {
	try {
		const syncStartTime = new Date().toISOString();

		const [testsRes, foldersRes, subjectsRes, attemptsRes, settingsRes] = await Promise.all([
			supabase.from('tests').select('*'),
			supabase.from('folders').select('*'),
			supabase.from('subjects').select('*'),
			supabase.from('attempts').select('*'),
			supabase.from('settings').select('*'),
		]);

		const remoteTests = testsRes.data || [];
		const remoteFolders = foldersRes.data || [];
		const remoteSubjects = subjectsRes.data || [];
		const remoteAttempts = attemptsRes.data || [];
		const remoteSettings = settingsRes.data || [];

		// Map tests
		const mappedTests: TestItem[] = remoteTests.map((row) => ({
			id: row.id,
			title: row.title,
			description: row.description || undefined,
			subjectId: row.subject_id,
			folderId: row.folder_id || null,
			durationMinutes: row.duration_minutes,
			totalMarks: row.total_marks,
			testFileName: row.test_file_name,
			testFileSizeFormatted: row.test_file_size_formatted,
			answerKeyFileName: row.answer_key_file_name || undefined,
			answerKeyFileSizeFormatted: row.answer_key_file_size_formatted || undefined,
			status: row.status as TestItem['status'],
			questions: (row.questions as unknown as TestItem['questions']) || [],
			blueprint: (row.blueprint as unknown as TestItem['blueprint']) || undefined,
			tokenUsage: (row.token_usage as unknown as TestItem['tokenUsage']) || undefined,
			aiProvider: (row.ai_provider as unknown as TestItem['aiProvider']) || undefined,
			aiModel: row.ai_model || undefined,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		}));

		// Map folders
		const mappedFolders: FolderItem[] = remoteFolders.map((row) => ({
			id: row.id,
			name: row.name,
			parentFolderId: row.parent_folder_id,
			color: row.color || undefined,
			icon: row.icon || undefined,
			order: row.order_index,
			description: row.description || undefined,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		}));

		// Map subjects
		const mappedSubjects: SubjectItem[] = remoteSubjects.map((row) => ({
			id: row.id,
			name: row.name,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		}));

		// Map attempts
		const mappedAttempts: TestAttempt[] = remoteAttempts.map((row) => ({
			id: row.id,
			testId: row.test_id,
			testTitle: row.test_title,
			startedAt: row.started_at,
			completedAt: row.completed_at || undefined,
			durationSecondsTaken: row.duration_seconds_taken,
			mode: row.mode as TestAttempt['mode'],
			status: row.status as TestAttempt['status'],
			responses: (row.responses as unknown as TestAttempt['responses']) || {},
			score: Number(row.score),
			maxPossibleScore: Number(row.max_possible_score),
			accuracyPercentage: Number(row.accuracy_percentage),
			totalQuestions: row.total_questions,
			answeredCount: row.answered_count,
			correctCount: row.correct_count,
			incorrectCount: row.incorrect_count,
			unattemptedCount: row.unattempted_count,
			reviewCount: row.review_count,
			updatedAt: row.updated_at,
		}));

		// Persist into Dexie
		await db.transaction(
			'rw',
			[db.tests, db.folders, db.subjects, db.attempts, db.settings],
			async () => {
				if (mappedTests.length > 0) await db.tests.bulkPut(mappedTests);
				if (mappedFolders.length > 0) await db.folders.bulkPut(mappedFolders);
				if (mappedSubjects.length > 0) await db.subjects.bulkPut(mappedSubjects);
				if (mappedAttempts.length > 0) await db.attempts.bulkPut(mappedAttempts);
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

			app.folders.rebuildIndices(app.tests.tests);
		}
	} catch (err) {
		console.error('[Full Sync] Failed pulling remote data:', err);
		throw err;
	}
}
