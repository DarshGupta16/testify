/**
 * Testify - PDF Ingestion, AI Testification & Assessment Synthesis Engine
 */

import { aiService, formatAiProviderError } from '$lib/services/ai';
import { extractPdfPagesAndImages, type PdfExtractionResult } from '$lib/services/pdf';
import type { QuestionPreview, TestItem, TestUploadPayload } from '$lib/types/test';

export type UploadProgressCallback = (progress: number, statusText: string) => void;

export interface ProcessUploadOptions {
	apiKey?: string;
	onProgress?: UploadProgressCallback;
}

/**
 * Service to handle PDF ingestion, MuPDF rasterization, vector diagram extraction,
 * and AI-powered test generation across Google, OpenAI, Anthropic, and Groq.
 */
export async function processTestUpload(
	payload: TestUploadPayload,
	options?: ProcessUploadOptions | UploadProgressCallback
): Promise<TestItem> {
	const onProgress: UploadProgressCallback | undefined =
		typeof options === 'function' ? options : options?.onProgress;
	const apiKey: string | undefined = typeof options === 'object' ? options.apiKey : undefined;

	const rawTestFile = payload.testFile?.rawFile;
	if (!rawTestFile) {
		throw new Error('No test PDF file provided. Please upload a question paper PDF.');
	}

	const targetProvider = payload.aiProvider;
	if (!targetProvider || !apiKey?.trim()) {
		throw new Error(
			`Please configure and unlock your ${targetProvider ? targetProvider.toUpperCase() : 'AI'} API key before creating a test.`
		);
	}

	const scale = payload.scale ?? 1.25;
	let extractionResult: PdfExtractionResult | null = null;
	let answerKeyExtractionResult: PdfExtractionResult | null = null;

	// Stage 1 & 2: Extract pages, bitmap images, and vector diagrams via MuPDF
	onProgress?.(5, 'Reading and rasterizing question paper PDF...');

	try {
		extractionResult = await extractPdfPagesAndImages(rawTestFile, {
			scale,
			onProgress: (p) => {
				const pct = Math.min(40, Math.round(5 + (p.currentPage / Math.max(1, p.totalPages)) * 35));
				onProgress?.(pct, `[PDF] ${p.statusText}`);
			},
		});
	} catch (err) {
		console.error('[TestUploader] PDF extraction error:', err);
		throw new Error(`Failed to parse question paper PDF: ${(err as Error).message}`);
	}

	if (!extractionResult || extractionResult.pages.length === 0) {
		throw new Error('Could not render any pages from the question paper PDF.');
	}

	// Stage 3: Extract separate Answer Key PDF if supplied
	if (payload.answerKeyFile?.rawFile) {
		onProgress?.(42, 'Rasterizing separate Answer Key document...');
		try {
			answerKeyExtractionResult = await extractPdfPagesAndImages(payload.answerKeyFile.rawFile, {
				scale: 1.0,
				onProgress: (p) => {
					onProgress?.(45, `[Key PDF] Page ${p.currentPage}/${p.totalPages}...`);
				},
			});
		} catch (err) {
			console.warn('[TestUploader] Answer key PDF extraction failed:', err);
		}
	}

	// Stage 4: AI Testification Execution
	const docName = payload.testFile?.name || 'test.pdf';
	const allDiagrams = extractionResult.pages.flatMap((p) => p.embeddedImages);

	let finalQuestions: QuestionPreview[] = [];
	let finalTitle = payload.title?.trim();
	let finalDuration: number | null = payload.isUntimed ? null : (payload.durationMinutes ?? 60);
	let finalTotalMarks = payload.totalMarks || 0;
	let tokenUsage: TestItem['tokenUsage'];

	try {
		onProgress?.(
			50,
			`Submitting document to ${targetProvider.toUpperCase()} (${payload.aiModel || 'default'})...`
		);

		const aiResult = await aiService.testify({
			provider: targetProvider,
			apiKey,
			model: payload.aiModel || 'default',
			extractionResult,
			answerKeyExtractionResult,
			metadata: {
				titleHint: payload.title,
				subjectHint: payload.subject,
				questionCountHint: payload.questionCount,
				autoTitle: payload.autoTitle,
				autoDuration: payload.autoDuration,
				isUntimed: payload.isUntimed,
				defaultDurationMinutes: payload.durationMinutes,
				defaultMarksPerQuestion: 4,
			},
			onProgress: (statusText, pct) => {
				const mappedPct = pct ? Math.round(50 + (pct / 100) * 45) : 70;
				onProgress?.(mappedPct, statusText);
			},
		});

		finalQuestions = aiResult.questions;
		tokenUsage = aiResult.tokenUsage;

		if (payload.autoTitle && aiResult.title) {
			finalTitle = aiResult.title;
		}
		if (payload.isUntimed) {
			finalDuration = null;
		} else if (payload.autoDuration && typeof aiResult.durationMinutes === 'number') {
			finalDuration = aiResult.durationMinutes;
		}
		if (typeof aiResult.totalMarks === 'number' && aiResult.totalMarks > 0) {
			finalTotalMarks = aiResult.totalMarks;
		}
	} catch (aiErr) {
		console.error('[TestUploader] AI generation failed:', aiErr);
		const formattedError = formatAiProviderError(targetProvider, aiErr);
		throw new Error(formattedError);
	}

	// Finalize fields
	if (!finalTitle) {
		finalTitle = docName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Untitled Test';
	}
	const count = finalQuestions.length;
	if (!finalTotalMarks || finalTotalMarks === 0) {
		finalTotalMarks = finalQuestions.reduce((acc, q) => acc + (q.marks || 4), 0);
	}

	onProgress?.(98, 'Persisting assessment & diagram assets...');
	await new Promise((r) => setTimeout(r, 100));

	onProgress?.(100, 'Assessment Ready!');

	const newId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

	const tags = [
		payload.subject || 'General',
		finalDuration ? `${finalDuration}m` : 'Untimed',
		`${count} Qs`,
		`${extractionResult.totalPages} ${extractionResult.totalPages === 1 ? 'Page' : 'Pages'}`,
	];

	if (allDiagrams.length > 0) {
		tags.push(`${allDiagrams.length} ${allDiagrams.length === 1 ? 'Figure' : 'Figures'}`);
	}

	return {
		id: newId,
		title: finalTitle,
		description:
			payload.description ||
			`Generated from ${docName} (${extractionResult.totalPages} pages, ${allDiagrams.length} extracted figures).`,
		subject: payload.subject || 'General',
		durationMinutes: finalDuration,
		questionCount: count,
		totalMarks: finalTotalMarks,
		hasAnswerKey: Boolean(payload.answerKeyFile || answerKeyExtractionResult),
		testFileName: docName,
		testFileSizeFormatted: payload.testFile?.formattedSize || '2.4 MB',
		answerKeyFileName: payload.answerKeyFile?.name,
		answerKeyFileSizeFormatted: payload.answerKeyFile?.formattedSize,
		createdAt: new Date().toISOString(),
		status: 'ready',
		tags,
		questions: finalQuestions,
		extractedData: extractionResult,
		extractedPagesCount: extractionResult.totalPages,
		extractedDiagramsCount: allDiagrams.length,
		renderScale: scale,
		aiProvider: payload.aiProvider,
		aiModel: payload.aiModel,
		tokenUsage,
	};
}
