import type { Database, Json } from '$lib/services/supabase/types';
import type { FolderItem } from '$lib/types/folder';
import type { SubjectItem } from '$lib/types/subject';
import type { TestAttempt, TestItem } from '$lib/types/test';

export type TestRow = Database['public']['Tables']['tests']['Row'];
export type TestInsert = Database['public']['Tables']['tests']['Insert'];

export type FolderRow = Database['public']['Tables']['folders']['Row'];
export type FolderInsert = Database['public']['Tables']['folders']['Insert'];

export type SubjectRow = Database['public']['Tables']['subjects']['Row'];
export type SubjectInsert = Database['public']['Tables']['subjects']['Insert'];

export type AttemptRow = Database['public']['Tables']['attempts']['Row'];
export type AttemptInsert = Database['public']['Tables']['attempts']['Insert'];

// ==========================================
// Tests Mappers
// ==========================================

export function rowToTest(row: TestRow): TestItem {
	return {
		id: row.id,
		title: row.title,
		description: row.description || undefined,
		subjectId: row.subject_id,
		folderId: row.folder_id || null,
		durationMinutes: row.duration_minutes,
		totalMarks: row.total_marks,
		testFileName: row.test_file_name,
		testFileSizeFormatted: row.test_file_size_formatted,
		answerKeyFileName: row.answer_key_file_name || undefined,
		answerKeyFileSizeFormatted: row.answer_key_file_size_formatted || undefined,
		status: row.status as TestItem['status'],
		questions: (row.questions as unknown as TestItem['questions']) || [],
		blueprint: (row.blueprint as unknown as TestItem['blueprint']) || undefined,
		tokenUsage: (row.token_usage as unknown as TestItem['tokenUsage']) || undefined,
		aiProvider: (row.ai_provider as unknown as TestItem['aiProvider']) || undefined,
		aiModel: row.ai_model || undefined,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export function testToRow(t: TestItem, userId?: string): TestInsert {
	const insert: TestInsert = {
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
		questions: (t.questions || []) as unknown as Json,
		blueprint: (t.blueprint || null) as unknown as Json,
		token_usage: (t.tokenUsage || null) as unknown as Json,
		ai_provider: t.aiProvider || null,
		ai_model: t.aiModel || null,
		created_at: t.createdAt,
		updated_at: t.updatedAt || new Date().toISOString(),
	};
	if (userId) {
		insert.user_id = userId;
	}
	return insert;
}

// ==========================================
// Folders Mappers
// ==========================================

export function rowToFolder(row: FolderRow): FolderItem {
	return {
		id: row.id,
		name: row.name,
		parentFolderId: row.parent_folder_id,
		color: row.color || undefined,
		icon: row.icon || undefined,
		order: row.order_index,
		description: row.description || undefined,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export function folderToRow(f: FolderItem, userId?: string): FolderInsert {
	const insert: FolderInsert = {
		id: f.id,
		name: f.name,
		parent_folder_id: f.parentFolderId || null,
		color: f.color || null,
		icon: f.icon || null,
		order_index: f.order,
		description: f.description || null,
		created_at: f.createdAt,
		updated_at: f.updatedAt || new Date().toISOString(),
	};
	if (userId) {
		insert.user_id = userId;
	}
	return insert;
}

// ==========================================
// Subjects Mappers
// ==========================================

export function rowToSubject(row: SubjectRow): SubjectItem {
	return {
		id: row.id,
		name: row.name,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export function subjectToRow(s: SubjectItem, userId?: string): SubjectInsert {
	const insert: SubjectInsert = {
		id: s.id,
		name: s.name,
		created_at: s.createdAt,
		updated_at: s.updatedAt || new Date().toISOString(),
	};
	if (userId) {
		insert.user_id = userId;
	}
	return insert;
}

// ==========================================
// Attempts Mappers
// ==========================================

export function rowToAttempt(row: AttemptRow): TestAttempt {
	return {
		id: row.id,
		testId: row.test_id,
		testTitle: row.test_title,
		startedAt: row.started_at,
		completedAt: row.completed_at || undefined,
		durationSecondsTaken: row.duration_seconds_taken,
		mode: row.mode as TestAttempt['mode'],
		status: row.status as TestAttempt['status'],
		responses: (row.responses as unknown as TestAttempt['responses']) || {},
		score: Number(row.score),
		maxPossibleScore: Number(row.max_possible_score),
		accuracyPercentage: Number(row.accuracy_percentage),
		totalQuestions: row.total_questions,
		answeredCount: row.answered_count,
		correctCount: row.correct_count,
		incorrectCount: row.incorrect_count,
		unattemptedCount: row.unattempted_count,
		reviewCount: row.review_count,
		updatedAt: row.updated_at,
	};
}

export function attemptToRow(a: TestAttempt, userId?: string): AttemptInsert {
	const insert: AttemptInsert = {
		id: a.id,
		test_id: a.testId,
		test_title: a.testTitle,
		started_at: a.startedAt,
		completed_at: a.completedAt || null,
		duration_seconds_taken: a.durationSecondsTaken,
		mode: a.mode,
		status: a.status,
		responses: (a.responses || {}) as unknown as Json,
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
	};
	if (userId) {
		insert.user_id = userId;
	}
	return insert;
}
