import { db, type OfflineOp } from '$lib/services/db';

/**
 * Attempts a Supabase operation. If the error indicates an offline state,
 * network drop, or server error (status >= 500), queues the operation
 * to Dexie `offlineOps` table for automatic replay upon reconnection.
 */
export async function trySupabaseOrQueue(
	supabaseFn: () => Promise<
		{ error: { message?: string; status?: number; code?: string } | null } | unknown
	>,
	offlineOp: Omit<OfflineOp, 'id' | 'timestamp'>
): Promise<void> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) {
		await db.addOfflineOp(offlineOp);
		console.warn(
			`[Sync Queue] Offline: Recorded ${offlineOp.action} for ${offlineOp.table}:${offlineOp.recordId}`
		);
		return;
	}

	try {
		const res = (await supabaseFn()) as
			| { error?: { message?: string; status?: number; code?: string } | null; status?: number }
			| undefined;

		if (res?.error) {
			const status = (res as any)?.status ?? res.error?.status;
			const is4xx = typeof status === 'number' && status >= 400 && status < 500;
			const isTransient =
				status === 0 ||
				(typeof status === 'number' && status >= 500 && status < 600) ||
				(status === undefined &&
					((typeof navigator !== 'undefined' && !navigator.onLine) ||
						res.error.message?.toLowerCase().includes('fetch') ||
						res.error.message?.toLowerCase().includes('network')));

			// Network error, gateway failure, or transient 5xx
			if (isTransient && !is4xx) {
				await db.addOfflineOp(offlineOp);
				console.warn(
					`[Sync Queue] Server/Network error (${status}): Recorded ${offlineOp.action} for ${offlineOp.table}:${offlineOp.recordId}`
				);
			} else {
				console.error(
					`[Sync Engine] Supabase rejected ${offlineOp.action} on ${offlineOp.table} (status: ${status}):`,
					res.error
				);
			}
		}
	} catch (err: unknown) {
		const isNetworkError =
			(typeof navigator !== 'undefined' && !navigator.onLine) ||
			(err instanceof TypeError && err.message.toLowerCase().includes('fetch')) ||
			(err &&
				typeof err === 'object' &&
				'status' in err &&
				((err as any).status === 0 ||
					(typeof (err as any).status === 'number' && (err as any).status >= 500)));

		if (isNetworkError) {
			await db.addOfflineOp(offlineOp);
			console.warn(
				`[Sync Queue] Network failure: Recorded ${offlineOp.action} for ${offlineOp.table}:${offlineOp.recordId}`
			);
		} else {
			console.error(
				`[Sync Engine] Uncaught error during ${offlineOp.action} on ${offlineOp.table}:`,
				err
			);
		}
	}
}
