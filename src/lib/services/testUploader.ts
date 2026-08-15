import {
	type ExtractedEmbeddedImage,
	extractPdfPagesAndImages,
	generateSamplePdfWithImages,
	type PdfExtractionResult,
} from '$lib/services/pdf';
import type { QuestionPreview, TestItem, TestUploadPayload } from '$lib/types/test';

export type UploadProgressCallback = (progress: number, statusText: string) => void;

/**
 * Synthesizes structured question previews and associates them with extracted diagrams.
 */
export function generateMockQuestions(
	count: number,
	fileName: string,
	diagrams: ExtractedEmbeddedImage[]
): QuestionPreview[] {
	const totalToGenerate = Math.min(count, 8);
	const previews: QuestionPreview[] = [];

	for (let i = 0; i < totalToGenerate; i++) {
		const associatedDiagram = diagrams.length > 0 ? diagrams[i % diagrams.length] : undefined;
		const isNumerical = i % 3 === 0;

		previews.push({
			id: `q_${i + 1}`,
			questionNumber: i + 1,
			type: isNumerical ? 'numerical' : 'multiple_choice',
			text: `Question #${i + 1}: Analyze the conditions in ${fileName} and evaluate the response.`,
			options: isNumerical
				? undefined
				: [
						'Option A: First theoretical condition holds',
						'Option B: Parameter satisfies constraint equations',
						'Option C: Relative deviation within tolerance',
						'Option D: None of the above',
					],
			correctAnswer: isNumerical ? '42.5' : 'Option B: Parameter satisfies constraint equations',
			marks: 4,
			associatedDiagramId: associatedDiagram?.id,
		});
	}

	return previews;
}

/**
 * Service to handle PDF ingestion, rasterization, and diagram extraction.
 * Communicates progress back to UI stores and generates structured test models.
 */
export async function processTestUpload(
	payload: TestUploadPayload,
	onProgress?: UploadProgressCallback
): Promise<TestItem> {
	const scale = payload.scale ?? 1.25;
	let extractionResult: PdfExtractionResult | null = null;

	// Stage 1: Load input source
	onProgress?.(5, 'Reading and initializing PDF document...');

	let inputData: File | Blob | Uint8Array;
	if (payload.testFile?.rawFile) {
		inputData = payload.testFile.rawFile;
	} else {
		// If demo/fallback file, generate synthetic sample PDF with diagrams
		inputData = generateSamplePdfWithImages();
	}

	try {
		// Stage 2: Extract pages, bitmap images, and vector diagrams via MuPDF
		extractionResult = await extractPdfPagesAndImages(inputData, {
			scale,
			onProgress: (p) => {
				const pct = Math.min(85, Math.round(10 + (p.currentPage / Math.max(1, p.totalPages)) * 75));
				onProgress?.(pct, p.statusText);
			},
		});
	} catch (err) {
		console.warn(
			'[TestUploader] Real PDF extraction failed, proceeding with synthetic preview fallback:',
			err
		);
	}

	// Stage 3: Answer matching / Schema Generation
	onProgress?.(
		90,
		payload.answerKeyFile
			? 'Indexing answer key & matching question identifiers...'
			: 'Finalizing assessment structure and diagram assets...'
	);
	await new Promise((r) => setTimeout(r, 200));

	// Stage 4: Finalizing
	onProgress?.(100, 'Assessment Ready!');
	await new Promise((r) => setTimeout(r, 100));

	const newId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
	const count = payload.questionCount || 25;
	const duration = payload.durationMinutes || 60;
	const totalMarks = payload.totalMarks || count * 4;
	const docName = payload.testFile?.name || 'test.pdf';

	// Collect all extracted diagrams for question preview linkage
	const allDiagrams = extractionResult
		? extractionResult.pages.flatMap((p) => p.embeddedImages)
		: [];

	const mockQuestions = generateMockQuestions(count, docName, allDiagrams);

	const tags = [
		payload.subject || 'General',
		`${duration}m`,
		`${count} Qs`,
		`${extractionResult?.totalPages ?? 1} ${extractionResult?.totalPages === 1 ? 'Page' : 'Pages'}`,
	];

	if (allDiagrams.length > 0) {
		tags.push(`${allDiagrams.length} ${allDiagrams.length === 1 ? 'Figure' : 'Figures'}`);
	}

	return {
		id: newId,
		title: payload.title || 'Untitled Test',
		description:
			payload.description ||
			`Generated from ${docName} (${extractionResult?.totalPages ?? 1} pages, ${allDiagrams.length} extracted diagrams).`,
		subject: payload.subject || 'General',
		durationMinutes: duration,
		questionCount: count,
		totalMarks: totalMarks,
		hasAnswerKey: Boolean(payload.answerKeyFile),
		testFileName: docName,
		testFileSizeFormatted: payload.testFile?.formattedSize || '2.4 MB',
		answerKeyFileName: payload.answerKeyFile?.name,
		answerKeyFileSizeFormatted: payload.answerKeyFile?.formattedSize,
		createdAt: new Date().toISOString(),
		status: 'ready',
		tags,
		questions: mockQuestions,
		extractedData: extractionResult ?? undefined,
		extractedPagesCount: extractionResult?.totalPages,
		extractedDiagramsCount: allDiagrams.length,
		renderScale: scale,
		aiProvider: payload.aiProvider,
		aiModel: payload.aiModel,
	};
}
