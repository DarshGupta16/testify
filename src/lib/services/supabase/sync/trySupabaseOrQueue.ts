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
			| { error?: { message?: string; status?: number; code?: string } }
			| undefined;
		if (res?.error) {
			const status = res.error.status;
			// Network error, gateway failure, or transient 5xx
			if (!status || (typeof status === 'number' && status >= 500 && status < 600)) {
				await db.addOfflineOp(offlineOp);
				console.warn(
					`[Sync Queue] Server/Network error (${status}): Recorded ${offlineOp.action} for ${offlineOp.table}:${offlineOp.recordId}`
				);
			} else {
				console.error(
					`[Sync Engine] Supabase rejected ${offlineOp.action} on ${offlineOp.table}:`,
					res.error
				);
			}
		}
	} catch (err: unknown) {
		const isNetworkError =
			!navigator.onLine ||
			(err instanceof TypeError && err.message.toLowerCase().includes('fetch')) ||
			(err &&
				typeof err === 'object' &&
				'status' in err &&
				(err.status === 0 || (typeof err.status === 'number' && err.status >= 500)));

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
