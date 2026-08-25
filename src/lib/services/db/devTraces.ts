import { dev } from '$app/environment';
import type { DevPipelineTrace } from '$lib/types/devTrace';
import { toCloneable } from '$lib/utils/snapshot.svelte';
import type { TestifyDatabase } from './database';

export async function saveDevTrace(db: TestifyDatabase, trace: DevPipelineTrace): Promise<void> {
	if (!dev) return;
	try {
		await db.devTraces.put(toCloneable(trace));
	} catch (err) {
		console.warn('[DB] Failed to persist dev pipeline trace:', err);
	}
}

export async function getDevTrace(
	db: TestifyDatabase,
	testId: string
): Promise<DevPipelineTrace | undefined> {
	if (!dev) return undefined;
	try {
		const direct = await db.devTraces.get(testId);
		if (direct) return direct;
		const byTestId = await db.devTraces.where('testId').equals(testId).first();
		return byTestId;
	} catch (err) {
		console.warn(`[DB] Failed to get dev pipeline trace for "${testId}":`, err);
		return undefined;
	}
}

export async function getAllDevTraces(db: TestifyDatabase): Promise<DevPipelineTrace[]> {
	if (!dev) return [];
	try {
		return await db.devTraces.orderBy('createdAt').reverse().toArray();
	} catch (err) {
		console.warn('[DB] Failed to load all dev pipeline traces:', err);
		return [];
	}
}

export async function deleteDevTrace(db: TestifyDatabase, id: string): Promise<void> {
	if (!dev) return;
	try {
		await db.devTraces.delete(id);
	} catch (err) {
		console.warn(`[DB] Failed to delete dev pipeline trace "${id}":`, err);
	}
}

export async function clearAllDevTraces(db: TestifyDatabase): Promise<void> {
	if (!dev) return;
	try {
		await db.devTraces.clear();
	} catch (err) {
		console.warn('[DB] Failed to clear dev pipeline traces:', err);
	}
}
