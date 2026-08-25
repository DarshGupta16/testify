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
	await db.subjects.put(toCloneable(subject));
}

export async function bulkSaveSubjects(
	db: TestifyDatabase,
	subjectsList: SubjectItem[]
): Promise<void> {
	await db.subjects.bulkPut(toCloneable(subjectsList));
}

export async function deleteSubject(db: TestifyDatabase, id: string): Promise<void> {
	await db.subjects.delete(id);
}

export async function clearAllSubjects(db: TestifyDatabase): Promise<void> {
	await db.subjects.clear();
}
