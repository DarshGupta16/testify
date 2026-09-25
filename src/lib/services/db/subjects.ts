import type { SubjectItem } from '$lib/types/subject';
import { toCloneable } from '$lib/utils/snapshot.svelte';
import type { TestifyDatabase } from './database';

export async function getAllSubjects(db: TestifyDatabase): Promise<SubjectItem[]> {
	try {
		return await db.subjects.toArray();
	} catch (err) {
		console.error('[DB] Failed to get all subjects:', err);
		return [];
	}
}

export async function saveSubject(db: TestifyDatabase, subject: SubjectItem): Promise<void> {
	const record = {
		...subject,
		updatedAt: subject.updatedAt || new Date().toISOString(),
	};
	await db.subjects.put(toCloneable(record));
}

export async function bulkSaveSubjects(
	db: TestifyDatabase,
	subjectsList: SubjectItem[]
): Promise<void> {
	const now = new Date().toISOString();
	const stamped = subjectsList.map((s) => ({
		...s,
		updatedAt: s.updatedAt || now,
	}));
	await db.subjects.bulkPut(toCloneable(stamped));
}

export async function deleteSubject(db: TestifyDatabase, id: string): Promise<void> {
	await db.subjects.delete(id);
}

export async function clearAllSubjects(db: TestifyDatabase): Promise<void> {
	await db.subjects.clear();
}
