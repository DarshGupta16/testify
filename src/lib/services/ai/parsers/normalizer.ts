/**
 * Testify - AI Question Normalization & Schema Validation Service
 */

import type { AIDiagramAsset, RawAIQuestion } from '$lib/types/ai';
import type { QuestionPreview } from '$lib/types/test';

/**
 * Decodes unicode escape sequences (e.g. \u00c5 or \\u00c5 -> Å) into actual unicode characters.
 */
export function decodeUnicodeEscapes(str: string): string {
	if (!str || typeof str !== 'string') return str;
	return str.replace(/(?:\\+)?u([0-9a-fA-F]{4})/g, (_, hex) => {
		try {
			return String.fromCharCode(Number.parseInt(hex, 16));
		} catch {
			return _;
		}
	});
}

/**
 * Normalizes and enriches raw AI questions with IDs, diagram URL mappings, and schema validation.
 */
export function normalizeQuestions(
	rawQuestions: RawAIQuestion[],
	diagrams?: AIDiagramAsset[],
	defaultMarks = 4
): QuestionPreview[] {
	const diagramMap = new Map<string, string>();
	if (diagrams) {
		for (const diag of diagrams) {
			diagramMap.set(diag.id, diag.dataUrl);
		}
	}

	return rawQuestions
		.filter(
			(q) => q && typeof q === 'object' && typeof q.text === 'string' && q.text.trim().length > 0
		)
		.map((q, index) => {
			const qNum = typeof q.questionNumber === 'number' ? q.questionNumber : index + 1;
			const id = `q_${qNum}_${Math.random().toString(36).substring(2, 6)}`;

			// Strict unambiguous question type classification
			const rawType = String(q.type || '').toLowerCase();
			let type: 'single_choice' | 'multi_choice' | 'numerical' = 'single_choice';

			const hasMultiAnswers =
				(Array.isArray(q.correctAnswers) && q.correctAnswers.length > 1) ||
				(Array.isArray(q.correctAnswer) && q.correctAnswer.length > 1) ||
				rawType.includes('multi');

			if (
				rawType.includes('num') ||
				(!q.options && q.correctAnswer && !Number.isNaN(Number(q.correctAnswer)))
			) {
				type = 'numerical';
			} else if (rawType.includes('single')) {
				type = 'single_choice';
			} else if (hasMultiAnswers) {
				type = 'multi_choice';
			} else {
				type = 'single_choice';
			}

			// Ensure options are structured as QuestionOption[] if single_choice or multi_choice
			let options: Array<{ id: string; text: string }> | undefined;
			let correctAnswer: string | undefined;
			let correctAnswers: string[] | undefined;

			if (type === 'single_choice' || type === 'multi_choice') {
				if (Array.isArray(q.options) && q.options.length > 0) {
					options = q.options.map((opt) => {
						if (typeof opt === 'object' && opt !== null && 'text' in opt) {
							const optId = opt.id?.trim() || `opt_${Math.random().toString(36).substring(2, 8)}`;
							return {
								id: optId,
								// PRESERVE option text and decode unicode escapes
								text: decodeUnicodeEscapes(String(opt.text || '')),
							};
						}
						const optStr = String(opt);
						return {
							id: `opt_${Math.random().toString(36).substring(2, 8)}`,
							text: decodeUnicodeEscapes(optStr),
						};
					});
				} else {
					// Fallback synthesis if options were omitted
					options = [
						{
							id: `opt_${Math.random().toString(36).substring(2, 8)}`,
							text: 'Statement 1 satisfies conditions',
						},
						{
							id: `opt_${Math.random().toString(36).substring(2, 8)}`,
							text: 'Statement 2 satisfies conditions',
						},
						{
							id: `opt_${Math.random().toString(36).substring(2, 8)}`,
							text: 'Statement 3 satisfies conditions',
						},
						{ id: `opt_${Math.random().toString(36).substring(2, 8)}`, text: 'None of the above' },
					];
				}

				// Helper to resolve an answer token to option ID with safety-net fallbacks
				const resolveOptionId = (token: unknown): string | undefined => {
					if (token === null || token === undefined) return undefined;
					const trimmed = String(token).trim();
					if (!trimmed || !options || options.length === 0) return undefined;

					// 1. Direct ID match (case-insensitive)
					const direct = options.find((o) => o.id.toLowerCase() === trimmed.toLowerCase());
					if (direct) return direct.id;

					// 2. Letter match safety net (e.g. "A", "B", "C", "D", "Option A", "Opt (B)", "(C)", "Choice D", "A.")
					const letterMatch = trimmed.match(
						/(?:(?:option|opt|choice|statement|item)\s*[:.-]?\s*)?[(['"]?([A-Za-z])[)\]'"]?(?:\s*[:.)-]|\s*$)/i
					);
					if (letterMatch?.[1]) {
						const letter = letterMatch[1].toUpperCase();
						const idx = letter.charCodeAt(0) - 65; // A -> 0, B -> 1, C -> 2, D -> 3...
						if (idx >= 0 && idx < options.length) {
							return options[idx].id;
						}
					}

					// 3. Numeric 1-based option index safety net (e.g. "1", "2", "3", "4", "Option 1", "(1)", "1.")
					const numMatch = trimmed.match(
						/(?:(?:option|opt|choice|statement|item)\s*[:.-]?\s*)?[(['"]?([1-9]\d*)[)\]'"]?(?:\s*[:.)-]|\s*$)/i
					);
					if (numMatch?.[1]) {
						const numIdx = Number.parseInt(numMatch[1], 10) - 1;
						if (numIdx >= 0 && numIdx < options.length) {
							return options[numIdx].id;
						}
					}

					// 4. Normalized text matching safety net (stripping LaTeX math $, \text{}, spaces)
					const cleanToken = trimmed
						.replace(/[$`]/g, '')
						.replace(/\\text\{([^}]+)\}/g, '$1')
						.replace(/\\left|\\right/g, '')
						.replace(/\s+/g, '')
						.toLowerCase();

					if (cleanToken.length > 0) {
						for (const o of options) {
							const cleanOpt = o.text
								.replace(/[$`]/g, '')
								.replace(/\\text\{([^}]+)\}/g, '$1')
								.replace(/\\left|\\right/g, '')
								.replace(/\s+/g, '')
								.toLowerCase();
							if (cleanOpt === cleanToken) {
								return o.id;
							}
						}

						if (cleanToken.length >= 2) {
							for (const o of options) {
								const cleanOpt = o.text
									.replace(/[$`]/g, '')
									.replace(/\\text\{([^}]+)\}/g, '$1')
									.replace(/\\left|\\right/g, '')
									.replace(/\s+/g, '')
									.toLowerCase();
								if (cleanOpt.includes(cleanToken) || cleanToken.includes(cleanOpt)) {
									return o.id;
								}
							}
						}
					}

					return undefined;
				};

				// Resolve correct answers
				if (type === 'multi_choice') {
					const rawAnswerList: string[] = [];
					if (Array.isArray(q.correctAnswers)) {
						rawAnswerList.push(...q.correctAnswers.map(String));
					}
					if (Array.isArray(q.correctAnswer)) {
						rawAnswerList.push(...q.correctAnswer.map(String));
					} else if (typeof q.correctAnswer === 'string' && q.correctAnswer.trim()) {
						// Comma, semicolon, slash or space separated letters/IDs (e.g. "opt_1, opt_2")
						const tokens = q.correctAnswer.split(/[,;\s/]+/).filter(Boolean);
						rawAnswerList.push(...tokens);
					}

					const mappedIds: string[] = [];
					for (const item of rawAnswerList) {
						const optId = resolveOptionId(item);
						if (optId && !mappedIds.includes(optId)) {
							mappedIds.push(optId);
						}
					}

					// If mapping produced matches, set correctAnswers
					if (mappedIds.length > 0) {
						correctAnswers = mappedIds;
						correctAnswer = mappedIds[0];
					} else if (options && options.length > 0) {
						correctAnswers = [options[0].id];
						correctAnswer = options[0].id;
					}
				} else {
					// Single choice: check correctAnswer first, or fallback to correctAnswers[0]
					let candidate: unknown;
					if (
						q.correctAnswer !== undefined &&
						q.correctAnswer !== null &&
						String(q.correctAnswer).trim() !== ''
					) {
						candidate = Array.isArray(q.correctAnswer) ? q.correctAnswer[0] : q.correctAnswer;
					} else if (Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0) {
						candidate = q.correctAnswers[0];
					}

					if (candidate !== undefined && candidate !== null) {
						correctAnswer = resolveOptionId(candidate) || options[0]?.id;
					} else if (options && options.length > 0) {
						correctAnswer = options[0].id;
					}
				}
			} else if (type === 'numerical') {
				correctAnswer = q.correctAnswer ? String(q.correctAnswer).trim() : '0.0';
			}

			// Resolve diagram URL from catalog
			let associatedDiagramId = q.associatedDiagramId?.trim() || undefined;
			let associatedDiagramUrl: string | undefined;

			if (associatedDiagramId) {
				associatedDiagramUrl = diagramMap.get(associatedDiagramId);
				if (!associatedDiagramUrl) {
					// If ID was mismatched, attempt fuzzy match
					const queryId = associatedDiagramId.toLowerCase();
					const matchedKey = Array.from(diagramMap.keys()).find((k) =>
						k.toLowerCase().includes(queryId)
					);
					if (matchedKey) {
						associatedDiagramId = matchedKey;
						associatedDiagramUrl = diagramMap.get(matchedKey);
					}
				}
			}

			const marks = typeof q.marks === 'number' && q.marks > 0 ? q.marks : defaultMarks;
			const negativeMarks = typeof q.negativeMarks === 'number' ? q.negativeMarks : 0;

			return {
				id,
				questionNumber: qNum,
				text: decodeUnicodeEscapes(String(q.text || `Question ${qNum}`).trim()),
				type,
				options,
				correctAnswer,
				correctAnswers,
				hint: q.hint ? decodeUnicodeEscapes(String(q.hint).trim()) : undefined,
				explanation: q.explanation ? decodeUnicodeEscapes(String(q.explanation).trim()) : undefined,
				marks,
				negativeMarks,
				associatedDiagramId,
				associatedDiagramUrl,
				pageNumber: typeof q.pageNumber === 'number' ? q.pageNumber : undefined,
			};
		});
}
