import type { QuestionPreview, TestItem, TestUploadPayload } from '$lib/types/test';

export type UploadProgressCallback = (progress: number, statusText: string) => void;

/**
 * Service to handle PDF ingestion and test extraction.
 * Decoupled from store state for easy testing and future backend API integration.
 */
export async function processTestUpload(
	payload: TestUploadPayload,
	onProgress?: UploadProgressCallback
): Promise<TestItem> {
	// Stage 1: File reading
	onProgress?.(10, 'Reading and indexing test PDF...');
	await new Promise((r) => setTimeout(r, 450));

	// Stage 2: Question extraction
	onProgress?.(40, 'Parsing questions, equations, and diagrams...');
	await new Promise((r) => setTimeout(r, 550));

	// Stage 3: Answer matching
	onProgress?.(
		75,
		payload.answerKeyFile
			? 'Matching question keys with answer key PDF...'
			: 'Generating interactive test schema...'
	);
	await new Promise((r) => setTimeout(r, 450));

	// Stage 4: Finalizing
	onProgress?.(100, 'Test Ready!');
	await new Promise((r) => setTimeout(r, 200));

	const newId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
	const count = payload.questionCount || 25;
	const duration = payload.durationMinutes || 60;
	const totalMarks = payload.totalMarks || count * 4;

	// Mock question generation for interactive structure previews
	const mockQuestions: QuestionPreview[] = Array.from({ length: Math.min(count, 8) }).map(
		(_, i) => ({
			id: `q_${i + 1}`,
			questionNumber: i + 1,
			type: i % 3 === 0 ? 'numerical' : 'multiple_choice',
			text: `Sample question #${i + 1} extracted from ${payload.testFile?.name || 'test.pdf'}: Analyze the problem statement and determine the correct output.`,
			options:
				i % 3 === 0
					? undefined
					: [
							'Option A: First theoretical assumption',
							'Option B: Second validated parameter',
							'Option C: Constant deviation factor',
							'Option D: None of the above',
						],
			correctAnswer: i % 3 === 0 ? '42.5' : 'Option B: Second validated parameter',
			marks: 4,
		})
	);

	return {
		id: newId,
		title: payload.title || 'Untitled Test',
		description:
			payload.description || `Generated from ${payload.testFile?.name || 'PDF Document'}`,
		subject: payload.subject || 'General',
		durationMinutes: duration,
		questionCount: count,
		totalMarks: totalMarks,
		hasAnswerKey: Boolean(payload.answerKeyFile),
		testFileName: payload.testFile?.name || 'test_paper.pdf',
		testFileSizeFormatted: payload.testFile?.formattedSize || '2.4 MB',
		answerKeyFileName: payload.answerKeyFile?.name,
		answerKeyFileSizeFormatted: payload.answerKeyFile?.formattedSize,
		createdAt: new Date().toISOString(),
		status: 'ready',
		tags: [payload.subject || 'General', `${duration}m`, `${count} Qs`],
		questions: mockQuestions,
	};
}
