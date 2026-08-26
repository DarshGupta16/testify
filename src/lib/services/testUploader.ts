/**
 * Testify - PDF Ingestion, AI Testification & Assessment Synthesis Engine
 */

import { dev } from '$app/environment';
import { aiService, formatAiProviderError } from '$lib/services/ai';
import { buildUserPrompt, TESTIFY_SYSTEM_PROMPT } from '$lib/services/ai/prompts';
import { db, fireAndForget } from '$lib/services/db';
import { precompileQuestionsMath } from '$lib/services/mathHtmlCompiler';
import { extractPdfPagesAndImages, type PdfExtractionResult } from '$lib/services/pdf';
import type { DevPipelineTrace } from '$lib/types/devTrace';
import { DEFAULT_SUBJECT_IDS } from '$lib/types/subject';
import type { QuestionPreview, TestItem, TestUploadPayload } from '$lib/types/test';

export type UploadProgressCallback = (progress: number, statusText: string) => void;

export interface ProcessUploadOptions {
	apiKey?: string;
	signal?: AbortSignal;
	onProgress?: UploadProgressCallback;
}

/**
 * Service to handle PDF ingestion, document processing, vector diagram extraction,
 * and AI-powered test generation across Google, OpenAI, Anthropic, and Groq.
 */
export async function processTestUpload(
	payload: TestUploadPayload,
	options?: ProcessUploadOptions | UploadProgressCallback
): Promise<TestItem> {
	const overallStartTime = performance.now();
	const onProgress: UploadProgressCallback | undefined =
		typeof options === 'function' ? options : options?.onProgress;
	const apiKey: string | undefined = typeof options === 'object' ? options.apiKey : undefined;
	const signal: AbortSignal | undefined = typeof options === 'object' ? options.signal : undefined;

	if (signal?.aborted) {
		throw new DOMException('Operation cancelled by user', 'AbortError');
	}

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
	onProgress?.(5, 'Processing question paper PDF...');

	if (signal?.aborted) {
		throw new DOMException('Operation cancelled by user', 'AbortError');
	}

	const extractionStartTime = performance.now();
	try {
		extractionResult = await extractPdfPagesAndImages(rawTestFile, {
			scale,
			onProgress: (p) => {
				if (signal?.aborted) {
					throw new DOMException('Operation cancelled by user', 'AbortError');
				}
				const pct = Math.min(40, Math.round(5 + (p.currentPage / Math.max(1, p.totalPages)) * 35));
				onProgress?.(pct, `[PDF] Page ${p.currentPage}/${p.totalPages} processed`);
			},
		});
	} catch (err) {
		if ((err as Error).name === 'AbortError' || signal?.aborted) {
			throw new DOMException('Operation cancelled by user', 'AbortError');
		}
		console.error('[TestUploader] PDF extraction error:', err);
		throw new Error(`Failed to parse question paper PDF: ${(err as Error).message}`);
	}
	const extractionDurationMs = Math.round(performance.now() - extractionStartTime);

	if (!extractionResult || extractionResult.pages.length === 0) {
		throw new Error('Could not render any pages from the question paper PDF.');
	}

	if (signal?.aborted) {
		throw new DOMException('Operation cancelled by user', 'AbortError');
	}

	// Stage 3: Extract separate Answer Key PDF if supplied
	if (payload.answerKeyFile?.rawFile) {
		onProgress?.(42, 'Processing separate Answer Key document...');
		try {
			answerKeyExtractionResult = await extractPdfPagesAndImages(payload.answerKeyFile.rawFile, {
				scale: 1.0,
				onProgress: (p) => {
					if (signal?.aborted) {
						throw new DOMException('Operation cancelled by user', 'AbortError');
					}
					onProgress?.(45, `[Key PDF] Page ${p.currentPage}/${p.totalPages}...`);
				},
			});
		} catch (err) {
			if ((err as Error).name === 'AbortError' || signal?.aborted) {
				throw new DOMException('Operation cancelled by user', 'AbortError');
			}
			console.warn('[TestUploader] Answer key PDF extraction failed:', err);
		}
	}

	if (signal?.aborted) {
		throw new DOMException('Operation cancelled by user', 'AbortError');
	}

	// Stage 4: AI Testification Execution
	const docName = payload.testFile?.name || 'test.pdf';
	const allDiagrams = extractionResult.pages.flatMap((p) => p.embeddedImages);

	let finalQuestions: QuestionPreview[] = [];
	let finalTitle = payload.title?.trim();
	let finalDuration: number | null = payload.isUntimed ? null : (payload.durationMinutes ?? 60);
	let finalTotalMarks = payload.totalMarks || 0;
	let tokenUsage: TestItem['tokenUsage'];
	let aiDiagnostics: DevPipelineTrace['stages']['normalization'] | undefined;
	let aiParserDiagnostics: DevPipelineTrace['stages']['parser'] | undefined;
	let aiRawResponseText = '';
	let aiDurationMs = 0;

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

		finalQuestions = precompileQuestionsMath(aiResult.questions);
		tokenUsage = aiResult.tokenUsage;
		aiRawResponseText = aiResult.rawResponse || '';
		aiDurationMs = aiResult.diagnostics?.durationMs || 0;
		aiParserDiagnostics = aiResult.diagnostics?.parser;
		aiDiagnostics = aiResult.diagnostics?.normalization;

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
	if (!finalTotalMarks || finalTotalMarks === 0) {
		finalTotalMarks = finalQuestions.reduce((acc, q) => acc + (q.marks || 4), 0);
	}

	onProgress?.(98, 'Persisting assessment & diagram assets...');

	const newId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
	const chosenSubjectId = payload.subjectId || DEFAULT_SUBJECT_IDS.GENERAL;
	const createdAtIso = new Date().toISOString();

	// Persist extracted heavy document assets to dedicated Dexie table asynchronously
	fireAndForget(db.saveTestDocAssets(newId, extractionResult), 'persisting test document assets');

	onProgress?.(100, 'Assessment Ready!');

	// Construct dev-only pipeline trace
	let devPipelineTrace: DevPipelineTrace | undefined;
	if (dev) {
		const diagramAssets = allDiagrams.map((d) => ({
			id: d.id,
			dataUrl: d.dataUrl,
			pageNumber: d.pageNumber,
			mimeType: d.mimeType,
		}));

		const builtUserPrompt = buildUserPrompt(
			{
				titleHint: payload.title,
				questionCountHint: payload.questionCount,
				autoTitle: payload.autoTitle,
				autoDuration: payload.autoDuration,
				isUntimed: payload.isUntimed,
				defaultDurationMinutes: payload.durationMinutes,
				defaultMarksPerQuestion: 4,
			},
			diagramAssets,
			Boolean(answerKeyExtractionResult && answerKeyExtractionResult.pages.length > 0)
		);

		devPipelineTrace = {
			id: newId,
			testId: newId,
			testTitle: finalTitle,
			createdAt: createdAtIso,
			provider: targetProvider,
			model: payload.aiModel || 'default',
			totalDurationMs: Math.round(performance.now() - overallStartTime),
			stages: {
				extraction: {
					durationMs: extractionDurationMs,
					scale,
					fileName: docName,
					fileSizeBytes: 'size' in rawTestFile ? rawTestFile.size : rawTestFile.byteLength,
					totalPages: extractionResult.totalPages,
					totalDiagrams: allDiagrams.length,
					pages: extractionResult.pages.map((p) => ({
						pageNumber: p.pageNumber,
						width: p.rasterWidth,
						height: p.rasterHeight,
						rasterSizeBytes: p.rasterSizeBytes,
						diagramCount: p.embeddedImages.length,
					})),
					diagrams: allDiagrams,
				},
				promptPayload: {
					systemPrompt: TESTIFY_SYSTEM_PROMPT,
					userPrompt: builtUserPrompt,
					pageAssetsCount: extractionResult.pages.length,
					diagramAssetsCount: allDiagrams.length,
					diagramCatalog: allDiagrams.map((d) => ({ id: d.id, pageNumber: d.pageNumber })),
				},
				aiResponse: {
					durationMs: aiDurationMs,
					rawResponseText: aiRawResponseText,
					tokenUsage,
				},
				parser: aiParserDiagnostics || {
					cleanedJsonText: '',
					sanitizedJsonText: '',
					parsedSchema: null,
				},
				normalization: aiDiagnostics || {
					questionsCount: finalQuestions.length,
					diagramResolutionLogs: [],
					finalQuestions,
				},
			},
		};

		// Save dev trace to Dexie IndexedDB
		fireAndForget(db.saveDevTrace(devPipelineTrace), 'persisting dev pipeline trace');
	}

	return {
		id: newId,
		title: finalTitle,
		description:
			payload.description ||
			`Generated from ${docName} (${extractionResult.totalPages} pages, ${allDiagrams.length} extracted figures).`,
		subjectId: chosenSubjectId,
		durationMinutes: finalDuration,
		totalMarks: finalTotalMarks,
		testFileName: docName,
		testFileSizeFormatted: payload.testFile?.formattedSize || '2.4 MB',
		answerKeyFileName: payload.answerKeyFile?.name,
		answerKeyFileSizeFormatted: payload.answerKeyFile?.formattedSize,
		createdAt: createdAtIso,
		status: 'ready',
		questions: finalQuestions,
		extractedPagesCount: extractionResult.totalPages,
		extractedDiagramsCount: allDiagrams.length,
		renderScale: scale,
		aiProvider: payload.aiProvider,
		aiModel: payload.aiModel,
		tokenUsage,
		devPipelineTrace,
	};
}
