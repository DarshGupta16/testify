/**
 * Generation Jobs Dexie IndexedDB Repository
 */

import type { PaperBlueprint } from '$lib/types/blueprint';
import type { StoredGenerationJob } from '$lib/types/queue';
import type { TestifyDatabase } from './database';

/**
 * Persist or update a single generation job
 */
export async function saveJob(db: TestifyDatabase, job: StoredGenerationJob): Promise<void> {
	await db.generationJobs.put(job);
}

/**
 * Get a single generation job by ID
 */
export async function getJobById(
	db: TestifyDatabase,
	id: string
): Promise<StoredGenerationJob | undefined> {
	return await db.generationJobs.get(id);
}

/**
 * Bulk persist or update multiple generation jobs
 */
export async function bulkSaveJobs(
	db: TestifyDatabase,
	jobs: StoredGenerationJob[]
): Promise<void> {
	if (jobs.length === 0) return;
	await db.generationJobs.bulkPut(jobs);
}

/**
 * Retrieve all persisted generation jobs ordered chronologically
 */
export async function getAllJobs(db: TestifyDatabase): Promise<StoredGenerationJob[]> {
	return await db.generationJobs.orderBy('createdAt').toArray();
}

/**
 * Retrieve all active or pending generation jobs (not completed, failed, or cancelled)
 */
export async function getIncompleteJobs(db: TestifyDatabase): Promise<StoredGenerationJob[]> {
	const all = await getAllJobs(db);
	return all.filter((job) => job.status === 'queued' || job.status === 'processing' || job.status === 'paused');
}

/**
 * Partial update for a specific generation job
 */
export async function updateJob(
	db: TestifyDatabase,
	id: string,
	updates: Partial<StoredGenerationJob>
): Promise<void> {
	await db.generationJobs.update(id, updates);
}

/**
 * Update the blueprint cache on a specific generation job
 */
export async function updateJobBlueprintCache(
	db: TestifyDatabase,
	id: string,
	blueprint: PaperBlueprint
): Promise<void> {
	await db.generationJobs.update(id, { blueprintCache: blueprint });
}

/**
 * Delete a specific generation job
 */
export async function deleteJob(db: TestifyDatabase, id: string): Promise<void> {
	await db.generationJobs.delete(id);
}

/**
 * Clear all completed, cancelled, or failed generation jobs
 */
export async function clearCompletedJobs(db: TestifyDatabase): Promise<void> {
	const completedOrTerminated = await db.generationJobs
		.filter(
			(job) =>
				job.status === 'completed' ||
				job.status === 'cancelled' ||
				job.status === 'failed'
		)
		.primaryKeys();

	if (completedOrTerminated.length > 0) {
		await db.generationJobs.bulkDelete(completedOrTerminated);
	}
}

/**
 * Clear all generation jobs completely
 */
export async function clearAllJobs(db: TestifyDatabase): Promise<void> {
	await db.generationJobs.clear();
}
