import { db } from '$lib/services/db';
import { supabase } from '$lib/services/supabase/client';
import type { FolderItem } from '$lib/types/folder';
import type { SubjectItem } from '$lib/types/subject';
import type { TestAttempt, TestItem } from '$lib/types/test';
import { attemptToRow, folderToRow, subjectToRow, testToRow } from './mappers';

/**
 * Replays all queued local offline operations to Supabase in FIFO timestamp order.
 */
export async function localToSupabaseSync(): Promise<void> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) {
		return;
	}

	const ops = await db.getAllOfflineOps();
	if (ops.length === 0) return;

	console.info(`[Sync Engine] Replaying ${ops.length} queued offline operations to Supabase...`);

	for (const op of ops) {
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			break;
		}

		try {
			let res: {
				error?: { message?: string; status?: number; code?: string } | null;
				status?: number;
			} | null = null;

			if (op.action === 'delete') {
				if (op.table === 'tests') {
					res = await supabase.from('tests').delete().eq('id', op.recordId);
				} else if (op.table === 'folders') {
					res = await supabase.from('folders').delete().eq('id', op.recordId);
				} else if (op.table === 'subjects') {
					res = await supabase.from('subjects').delete().eq('id', op.recordId);
				} else if (op.table === 'attempts') {
					res = await supabase.from('attempts').delete().eq('id', op.recordId);
				} else if (op.table === 'settings') {
					res = await supabase.from('settings').delete().eq('key', op.recordId);
				} else if (op.table === 'synced_api_keys') {
					res = await supabase.from('synced_api_keys').delete().eq('provider', op.recordId);
				}
			} else {
				// Create or Update (Upsert)
				if (op.table === 'tests') {
					res = await supabase.from('tests').upsert(testToRow(op.data as TestItem));
				} else if (op.table === 'folders') {
					res = await supabase.from('folders').upsert(folderToRow(op.data as FolderItem));
				} else if (op.table === 'subjects') {
					res = await supabase.from('subjects').upsert(subjectToRow(op.data as SubjectItem));
				} else if (op.table === 'attempts') {
					res = await supabase.from('attempts').upsert(attemptToRow(op.data as TestAttempt));
				} else if (op.table === 'settings') {
					const setting = op.data as { key: string; value: unknown; updatedAt: string };
					res = await supabase.from('settings').upsert({
						key: setting.key,
						value: setting.value as unknown as import('$lib/services/supabase/types').Json,
						updated_at: setting.updatedAt,
					});
				} else if (op.table === 'synced_api_keys') {
					const keyRec = op.data as {
						provider: string;
						securityMode: string;
						ciphertext: string;
						iv: string;
						salt: string;
						updatedAt: string;
					};
					res = await supabase.from('synced_api_keys').upsert({
						provider: keyRec.provider,
						security_mode: keyRec.securityMode,
						ciphertext: keyRec.ciphertext,
						iv: keyRec.iv,
						salt: keyRec.salt,
						updated_at: keyRec.updatedAt,
					});
				}
			}

			if (res?.error) {
				const status = (res as any)?.status ?? res.error?.status;
				const is4xx = typeof status === 'number' && status >= 400 && status < 500;
				if (is4xx) {
					console.error(
						`[Sync Engine] Non-retryable error for op ${op.id} (${op.table}:${op.recordId}) status ${status}:`,
						res.error
					);
					if (op.id !== undefined) {
						await db.deleteOfflineOp(op.id);
					}
				} else {
					console.warn(
						`[Sync Engine] Server error (${status}) for op ${op.id} (${op.table}:${op.recordId}), retaining in queue:`,
						res.error
					);
					break;
				}
			} else {
				if (op.id !== undefined) {
					await db.deleteOfflineOp(op.id);
				}
			}
		} catch (err) {
			console.error(`[Sync Engine] Failed to replay op ${op.id} (${op.table}):`, err);
			if (typeof navigator !== 'undefined' && !navigator.onLine) {
				break;
			}
			break;
		}
	}
}
