import { db, type TestifyDatabase } from '$lib/services/db';
import type { AppStore } from '$lib/stores/appContext.svelte';
import type { FolderItem } from '$lib/types/folder';
import type { SubjectItem } from '$lib/types/subject';
import type { TestAttempt, TestItem } from '$lib/types/test';

export interface BackupData {
	tests: TestItem[];
	folders: FolderItem[];
	subjects: SubjectItem[];
	attempts: TestAttempt[];
}

export interface BackupPayload {
	version: number;
	exportedAt: string;
	data: BackupData;
}

export interface BackupCounts {
	testsCount: number;
	foldersCount: number;
	subjectsCount: number;
	attemptsCount: number;
}

/**
 * Exports all test papers, folders, subjects, and test attempts to a downloadable JSON file.
 * Automatically initiates file download if executed in browser context.
 */
export async function exportBackupData(
	customDb: TestifyDatabase = db,
	triggerDownload: boolean = true
): Promise<{ payload: BackupPayload; counts: BackupCounts }> {
	const [tests, folders, subjects, attempts] = await Promise.all([
		customDb.getAllTests(),
		customDb.getAllFolders(),
		customDb.getAllSubjects(),
		customDb.getAllAttempts(),
	]);

	const payload: BackupPayload = {
		version: 1,
		exportedAt: new Date().toISOString(),
		data: { tests, folders, subjects, attempts },
	};

	if (triggerDownload && typeof document !== 'undefined') {
		const blob = new Blob([JSON.stringify(payload, null, 2)], {
			type: 'application/json',
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `testify-backup-${new Date().toISOString().slice(0, 10)}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	return {
		payload,
		counts: {
			testsCount: tests.length,
			foldersCount: folders.length,
			subjectsCount: subjects.length,
			attemptsCount: attempts.length,
		},
	};
}

/**
 * Imports a previously exported backup JSON payload into IndexedDB (Dexie) and
 * refreshes in-memory AppStore instances.
 *
 * CRITICAL FIX: Ensures subjects are properly bulk saved into Dexie (`db.bulkSaveSubjects`)
 * and the reactive in-memory `app.subjects` store to prevent silent data-loss!
 */
export async function importBackupData(
	fileOrContent: File | string,
	app: AppStore,
	customDb: TestifyDatabase = db
): Promise<BackupCounts> {
	let text: string;
	if (typeof fileOrContent === 'string') {
		text = fileOrContent;
	} else {
		text = await fileOrContent.text();
	}

	const parsed = JSON.parse(text);

	if (!parsed || !parsed.data || !Array.isArray(parsed.data.tests)) {
		throw new Error('Invalid backup file structure: missing data or tests collection.');
	}

	const {
		tests = [],
		folders = [],
		subjects = [],
		attempts = [],
	} = parsed.data as {
		tests?: TestItem[];
		folders?: FolderItem[];
		subjects?: SubjectItem[];
		attempts?: TestAttempt[];
	};

	// 1. Commit collections to Dexie in parallel
	const saveTasks: Promise<void>[] = [];
	if (folders.length > 0) saveTasks.push(customDb.bulkSaveFolders(folders));
	if (subjects.length > 0) saveTasks.push(customDb.bulkSaveSubjects(subjects));
	if (tests.length > 0) saveTasks.push(customDb.bulkSaveTests(tests));
	if (attempts.length > 0) saveTasks.push(customDb.bulkSaveAttempts(attempts));

	await Promise.all(saveTasks);

	// 2. Synchronize all reactive in-memory stores
	const [updatedFolders, updatedTests, updatedAttempts, updatedSubjects] = await Promise.all([
		customDb.getAllFolders(),
		customDb.getAllTests(),
		customDb.getAllAttempts(),
		customDb.getAllSubjects(),
	]);

	app.folders.folders = updatedFolders;
	app.tests.tests = updatedTests;
	app.folders.rebuildIndices(updatedTests);
	app.attempts.attempts = updatedAttempts;
	app.subjects.subjects = updatedSubjects;

	return {
		testsCount: tests.length,
		foldersCount: folders.length,
		subjectsCount: subjects.length,
		attemptsCount: attempts.length,
	};
}
