import { db } from '$lib/services/db';
import { supabase } from '$lib/services/supabase/client';
import type { FolderItem } from '$lib/types/folder';
import type { SubjectItem } from '$lib/types/subject';
import type { TestAttempt, TestItem } from '$lib/types/test';

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
			if (op.action === 'delete') {
				if (op.table === 'tests') {
					await supabase.from('tests').delete().eq('id', op.recordId);
				} else if (op.table === 'folders') {
					await supabase.from('folders').delete().eq('id', op.recordId);
				} else if (op.table === 'subjects') {
					await supabase.from('subjects').delete().eq('id', op.recordId);
				} else if (op.table === 'attempts') {
					await supabase.from('attempts').delete().eq('id', op.recordId);
				} else if (op.table === 'settings') {
					await supabase.from('settings').delete().eq('key', op.recordId);
				} else if (op.table === 'synced_api_keys') {
					await supabase.from('synced_api_keys').delete().eq('provider', op.recordId);
				}
			} else {
				// Create or Update (Upsert)
				if (op.table === 'tests') {
					const t = op.data as TestItem;
					await supabase.from('tests').upsert({
						id: t.id,
						title: t.title,
						description: t.description || null,
						subject_id: t.subjectId,
						folder_id: t.folderId || null,
						duration_minutes: t.durationMinutes,
						total_marks: t.totalMarks,
						test_file_name: t.testFileName,
						test_file_size_formatted: t.testFileSizeFormatted,
						answer_key_file_name: t.answerKeyFileName || null,
						answer_key_file_size_formatted: t.answerKeyFileSizeFormatted || null,
						status: t.status,
						questions: t.questions as unknown as import('$lib/services/supabase/types').Json,
						blueprint: t.blueprint as unknown as import('$lib/services/supabase/types').Json,
						token_usage: t.tokenUsage as unknown as import('$lib/services/supabase/types').Json,
						ai_provider: t.aiProvider || null,
						ai_model: t.aiModel || null,
						created_at: t.createdAt,
						updated_at: t.updatedAt || new Date().toISOString(),
					});
				} else if (op.table === 'folders') {
					const f = op.data as FolderItem;
					await supabase.from('folders').upsert({
						id: f.id,
						name: f.name,
						parent_folder_id: f.parentFolderId || null,
						color: f.color || null,
						icon: f.icon || null,
						order_index: f.order,
						description: f.description || null,
						created_at: f.createdAt,
						updated_at: f.updatedAt,
					});
				} else if (op.table === 'subjects') {
					const s = op.data as SubjectItem;
					await supabase.from('subjects').upsert({
						id: s.id,
						name: s.name,
						created_at: s.createdAt,
						updated_at: s.updatedAt || new Date().toISOString(),
					});
				} else if (op.table === 'attempts') {
					const a = op.data as TestAttempt;
					await supabase.from('attempts').upsert({
						id: a.id,
						test_id: a.testId,
						test_title: a.testTitle,
						started_at: a.startedAt,
						completed_at: a.completedAt || null,
						duration_seconds_taken: a.durationSecondsTaken,
						mode: a.mode,
						status: a.status,
						responses: a.responses as unknown as import('$lib/services/supabase/types').Json,
						score: a.score,
						max_possible_score: a.maxPossibleScore,
						accuracy_percentage: a.accuracyPercentage,
						total_questions: a.totalQuestions,
						answered_count: a.answeredCount,
						correct_count: a.correctCount,
						incorrect_count: a.incorrectCount,
						unattempted_count: a.unattemptedCount,
						review_count: a.reviewCount,
						updated_at: a.updatedAt || new Date().toISOString(),
					});
				} else if (op.table === 'settings') {
					const setting = op.data as { key: string; value: unknown; updatedAt: string };
					await supabase.from('settings').upsert({
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
					await supabase.from('synced_api_keys').upsert({
						provider: keyRec.provider,
						security_mode: keyRec.securityMode,
						ciphertext: keyRec.ciphertext,
						iv: keyRec.iv,
						salt: keyRec.salt,
						updated_at: keyRec.updatedAt,
					});
				}
			}

			if (op.id !== undefined) {
				await db.deleteOfflineOp(op.id);
			}
		} catch (err) {
			console.error(`[Sync Engine] Failed to replay op ${op.id} (${op.table}):`, err);
			if (typeof navigator !== 'undefined' && !navigator.onLine) {
				break;
			}
		}
	}
}
