import { db } from '$lib/services/db';
import { supabase } from '$lib/services/supabase/client';
import type { AppStore } from '$lib/stores/appContext.svelte';
import { supabaseDeltaSync } from './supabaseDeltaSync';

/**
 * Sets up Supabase Realtime channel subscriptions across all syncable tables.
 * Utilizes timestamp comparison (remote.updated_at > local.updatedAt) to prevent
 * echo loops from locally dispatched mutations.
 */
export function setupRealtimeSubscriptions(app: AppStore): () => void {
	// Clean up any pre-existing channel for this topic (e.g. from Vite HMR or previous subscription)
	try {
		const existingChannels = supabase.getChannels();
		const existing = existingChannels.find(
			(ch) =>
				ch.topic === 'realtime:public:testify_sync' ||
				(ch as unknown as { subTopic?: string }).subTopic === 'public:testify_sync'
		);
		if (existing) {
			supabase.removeChannel(existing);
		}
	} catch (err) {
		console.warn('[Realtime] Failed cleaning up previous channel:', err);
	}

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	const scheduleDeltaSync = () => {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(async () => {
			debounceTimer = null;
			try {
				await supabaseDeltaSync(app);
			} catch (err) {
				console.error('[Realtime] Debounced delta sync failed:', err);
			}
		}, 300);
	};

	const channel = supabase
		.channel('public:testify_sync')
		.on('postgres_changes', { event: '*', schema: 'public', table: 'tests' }, async (payload) => {
			if (payload.eventType === 'DELETE') {
				const id = payload.old.id as string;
				await db.tests.delete(id);
				app.tests.tests = app.tests.tests.filter((t) => t.id !== id);
				app.folders.rebuildIndices(app.tests.tests);
				return;
			}

			const remote = payload.new as { id: string; updated_at: string };
			const local = await db.tests.get(remote.id);
			if (
				local?.updatedAt &&
				new Date(local.updatedAt).getTime() >= new Date(remote.updated_at).getTime()
			) {
				return;
			}

			scheduleDeltaSync();
		})
		.on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, async (payload) => {
			if (payload.eventType === 'DELETE') {
				const id = payload.old.id as string;
				await db.folders.delete(id);
				app.folders.folders = app.folders.folders.filter((f) => f.id !== id);
				app.folders.rebuildIndices(app.tests.tests);
				return;
			}

			const remote = payload.new as { id: string; updated_at: string };
			const local = await db.folders.get(remote.id);
			if (
				local?.updatedAt &&
				new Date(local.updatedAt).getTime() >= new Date(remote.updated_at).getTime()
			) {
				return;
			}

			scheduleDeltaSync();
		})
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'subjects' },
			async (payload) => {
				if (payload.eventType === 'DELETE') {
					const id = payload.old.id as string;
					await db.subjects.delete(id);
					app.subjects.subjects = app.subjects.subjects.filter((s) => s.id !== id);
					return;
				}

				const remote = payload.new as { id: string; updated_at: string };
				const local = await db.subjects.get(remote.id);
				if (
					local?.updatedAt &&
					new Date(local.updatedAt).getTime() >= new Date(remote.updated_at).getTime()
				) {
					return;
				}

				scheduleDeltaSync();
			}
		)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'attempts' },
			async (payload) => {
				if (payload.eventType === 'DELETE') {
					const id = payload.old.id as string;
					await db.attempts.delete(id);
					app.attempts.attempts = app.attempts.attempts.filter((a) => a.id !== id);
					return;
				}

				const remote = payload.new as { id: string; updated_at: string };
				const local = await db.attempts.get(remote.id);
				if (
					local?.updatedAt &&
					new Date(local.updatedAt).getTime() >= new Date(remote.updated_at).getTime()
				) {
					return;
				}

				scheduleDeltaSync();
			}
		)
		.subscribe((status) => {
			if (status === 'SUBSCRIBED') {
				console.info('[Realtime] Subscribed to cloud synchronization events.');
			}
		});

	return () => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		supabase.removeChannel(channel);
	};
}
