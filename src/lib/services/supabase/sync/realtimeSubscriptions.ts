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

			await supabaseDeltaSync(app);
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

			await supabaseDeltaSync(app);
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

				await supabaseDeltaSync(app);
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

				await supabaseDeltaSync(app);
			}
		)
		.subscribe((status) => {
			if (status === 'SUBSCRIBED') {
				console.info('[Realtime] Subscribed to cloud synchronization events.');
			}
		});

	return () => {
		supabase.removeChannel(channel);
	};
}
