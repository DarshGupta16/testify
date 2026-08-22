/**
 * Testify - AI Question Normalization & Schema Validation Service
 */

import type { AIDiagramAsset, RawAIQuestion } from '$lib/types/ai';
import type { DiagramResolutionDiagnostic } from '$lib/types/devTrace';
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

export interface DiagramMatchResult {
	diagramId: string;
	diagramUrl: string;
	matchedTier: string;
	mentionsFigure: boolean;
}

/**
 * Multi-tier robust diagram resolver:
 * Reconciles raw AI diagram identifiers against the extracted diagram catalog using
 * exact lookup, normalized page/index regex parsing, contextual keyword detection,
 * explicit diagram mention scanning in text/explanation, and page-level fallback heuristics.
 */
export function resolveDiagram(
	rawDiagramId: string | null | undefined,
	questionPage: number | undefined,
	questionText: string,
	diagrams?: AIDiagramAsset[],
	explanationText?: string,
	hintText?: string
): DiagramMatchResult | undefined {
	if (!diagrams || diagrams.length === 0) return undefined;

	const diagramMap = new Map<string, AIDiagramAsset>();
	for (const d of diagrams) {
		diagramMap.set(d.id.toLowerCase(), d);
	}

	const combinedContext = `${questionText} ${explanationText || ''} ${hintText || ''}`;
	const mentionsFigure =
		/(?:figure|diagram|shown\s+in|refer\s+to|graph|circuit|schematic|plot|illustration|given\s+in|curve|triangle|setup|represented\s+by|chart)\b/i.test(
			combinedContext
		);

	const trimmedId = rawDiagramId?.trim();
	const isInvalidId =
		!trimmedId || /^(?:null|undefined|none|n\/a|no|false|0|""|'')$/i.test(trimmedId);

	// 1. Direct exact / normalized ID lookup
	if (!isInvalidId) {
		const directMatch = diagramMap.get(trimmedId.toLowerCase());
		if (directMatch) {
			return {
				diagramId: directMatch.id,
				diagramUrl: directMatch.dataUrl,
				matchedTier: 'Tier 1 (Exact ID Match)',
				mentionsFigure,
			};
		}

		if (questionPage !== undefined) {
			const candidateKeys = [
				`p${questionPage}_diag_${trimmedId}`,
				`p${questionPage}_img_${trimmedId}`,
				`p${questionPage}_vdiag_${trimmedId}`,
				`p${questionPage}_${trimmedId}`,
			];
			for (const key of candidateKeys) {
				const matchPrefixed = diagramMap.get(key.toLowerCase());
				if (matchPrefixed) {
					return {
						diagramId: matchPrefixed.id,
						diagramUrl: matchPrefixed.dataUrl,
						matchedTier: 'Tier 1 (Page-Prefixed Match)',
						mentionsFigure,
					};
				}
			}
		}
	}

	// 2. Explicit Catalog ID Mention in Question Text / Explanation / Hint
	// (e.g. AI wrote "From diagram p4_diag_1:" in explanation or question text)
	for (const d of diagrams) {
		const idPattern = new RegExp(`\\b${d.id}\\b`, 'i');
		if (idPattern.test(combinedContext)) {
			return {
				diagramId: d.id,
				diagramUrl: d.dataUrl,
				matchedTier: 'Tier 2 (Explicit Catalog ID in Text/Explanation)',
				mentionsFigure: true,
			};
		}
	}

	// 3. Structured regex match on ID string (e.g. "diag_p1_0", "p1_vdiag_1", "p1_img_2", "p2_1", "figure_1")
	if (!isInvalidId) {
		// Pattern A: Match page and index (e.g. "diag_p1_0", "p1_diag_1", "p1_1", "page 2 fig 1")
		const pageIdxMatch = trimmedId.match(
			/(?:p|page)?(\d+)[\s_\-:./]*(?:diag|vdiag|img|figure|fig|crop)?[\s_\-:./]*(\d+)/i
		);
		if (pageIdxMatch) {
			const targetPage = Number.parseInt(pageIdxMatch[1], 10);
			const targetIdx = Number.parseInt(pageIdxMatch[2], 10);

			const pageDiagrams = diagrams.filter((d) => d.pageNumber === targetPage);
			if (pageDiagrams.length > 0) {
				// Exact suffix match (e.g. ending in "_1")
				const exactSuffix = pageDiagrams.find((d) => d.id.endsWith(`_${targetIdx}`));
				if (exactSuffix)
					return {
						diagramId: exactSuffix.id,
						diagramUrl: exactSuffix.dataUrl,
						matchedTier: `Tier 3 (Regex Exact Suffix: P${targetPage} #${targetIdx})`,
						mentionsFigure,
					};

				// 0-based conversion (diag_p1_0 -> first diagram on page 1)
				if (targetIdx === 0 && pageDiagrams.length > 0) {
					return {
						diagramId: pageDiagrams[0].id,
						diagramUrl: pageDiagrams[0].dataUrl,
						matchedTier: `Tier 3 (Regex 0-Based: P${targetPage} #${targetIdx})`,
						mentionsFigure,
					};
				}
				// 1-based index (targetIdx 1 -> index 0)
				if (targetIdx >= 1 && targetIdx <= pageDiagrams.length) {
					return {
						diagramId: pageDiagrams[targetIdx - 1].id,
						diagramUrl: pageDiagrams[targetIdx - 1].dataUrl,
						matchedTier: `Tier 3 (Regex 1-Based: P${targetPage} #${targetIdx})`,
						mentionsFigure,
					};
				}
				if (pageDiagrams.length === 1) {
					return {
						diagramId: pageDiagrams[0].id,
						diagramUrl: pageDiagrams[0].dataUrl,
						matchedTier: `Tier 3 (Regex Single Page Diagram: P${targetPage})`,
						mentionsFigure,
					};
				}
			}
		}

		// Pattern B: Match index only (e.g. "diag_1", "fig_2", "figure 1")
		const idxOnlyMatch = trimmedId.match(/(?:diag|vdiag|img|figure|fig|crop)?[\s_\-:./]*(\d+)/i);
		if (idxOnlyMatch) {
			const targetIdx = Number.parseInt(idxOnlyMatch[1], 10);
			const effectivePage = questionPage ?? 1;
			const pageDiagrams = diagrams.filter((d) => d.pageNumber === effectivePage);

			if (pageDiagrams.length > 0) {
				if (targetIdx === 0) {
					return {
						diagramId: pageDiagrams[0].id,
						diagramUrl: pageDiagrams[0].dataUrl,
						matchedTier: `Tier 3 (Regex Index Only: #${targetIdx})`,
						mentionsFigure,
					};
				}
				if (targetIdx >= 1 && targetIdx <= pageDiagrams.length) {
					return {
						diagramId: pageDiagrams[targetIdx - 1].id,
						diagramUrl: pageDiagrams[targetIdx - 1].dataUrl,
						matchedTier: `Tier 3 (Regex Index Only: #${targetIdx})`,
						mentionsFigure,
					};
				}
				if (pageDiagrams.length === 1) {
					return {
						diagramId: pageDiagrams[0].id,
						diagramUrl: pageDiagrams[0].dataUrl,
						matchedTier: `Tier 3 (Regex Single Page Diagram: #${targetIdx})`,
						mentionsFigure,
					};
				}
			}
		}

		// Substring fallback
		const subMatch = diagrams.find(
			(d) =>
				d.id.toLowerCase().includes(trimmedId.toLowerCase()) ||
				trimmedId.toLowerCase().includes(d.id.toLowerCase())
		);
		if (subMatch) {
			return {
				diagramId: subMatch.id,
				diagramUrl: subMatch.dataUrl,
				matchedTier: `Tier 3 (Substring Match: "${trimmedId}")`,
				mentionsFigure,
			};
		}
	}

	// 4. Contextual fallback: question text mentions visual cues and page has matching diagrams
	if (mentionsFigure) {
		if (questionPage !== undefined) {
			const pageDiagrams = diagrams.filter((d) => d.pageNumber === questionPage);
			if (pageDiagrams.length === 1) {
				return {
					diagramId: pageDiagrams[0].id,
					diagramUrl: pageDiagrams[0].dataUrl,
					matchedTier: 'Tier 4 (Contextual: Keyword + Single Diagram on Page)',
					mentionsFigure: true,
				};
			}
			if (pageDiagrams.length > 1) {
				// Check if question specifies Figure 1 or Figure 2
				const figNum = combinedContext.match(
					/(?:figure|fig|diagram)\s*[:.]?\s*([1-9]\d*|[A-Za-z])/i
				);
				if (figNum?.[1]) {
					const token = figNum[1].toUpperCase();
					let idx = Number.parseInt(token, 10) - 1;
					if (Number.isNaN(idx)) {
						idx = token.charCodeAt(0) - 65; // A -> 0, B -> 1
					}
					if (idx >= 0 && idx < pageDiagrams.length) {
						return {
							diagramId: pageDiagrams[idx].id,
							diagramUrl: pageDiagrams[idx].dataUrl,
							matchedTier: `Tier 4 (Contextual: Specific Figure Name "${token}")`,
							mentionsFigure: true,
						};
					}
				}
				return {
					diagramId: pageDiagrams[0].id,
					diagramUrl: pageDiagrams[0].dataUrl,
					matchedTier: 'Tier 4 (Contextual: Keyword + First Diagram on Page)',
					mentionsFigure: true,
				};
			}
		} else if (diagrams.length === 1) {
			return {
				diagramId: diagrams[0].id,
				diagramUrl: diagrams[0].dataUrl,
				matchedTier: 'Tier 4 (Contextual: Keyword + Single Document Diagram)',
				mentionsFigure: true,
			};
		}
	}

	// 5. Single diagram on page fallback ONLY if question explicitly mentions visual figure cues
	// (Prevents blindly auto-linking single-diagram page graphics to unrelated numerical questions)
	if (mentionsFigure && questionPage !== undefined) {
		const pageDiagrams = diagrams.filter((d) => d.pageNumber === questionPage);
		if (pageDiagrams.length === 1) {
			return {
				diagramId: pageDiagrams[0].id,
				diagramUrl: pageDiagrams[0].dataUrl,
				matchedTier: 'Tier 5 (Single Diagram Page Auto-Link with Visual Cue)',
				mentionsFigure: true,
			};
		}
	}

	return undefined;
}

/**
 * Normalizes and enriches raw AI questions with IDs, diagram URL mappings, and schema validation.
 */
export function normalizeQuestions(
	rawQuestions: RawAIQuestion[],
	diagrams?: AIDiagramAsset[],
	defaultMarks = 4,
	outDiagnostics?: DiagramResolutionDiagnostic[]
): QuestionPreview[] {
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
			const questionPage = typeof q.pageNumber === 'number' ? q.pageNumber : undefined;
			const qText = String(q.text || '');
			const qExplanation = q.explanation ? String(q.explanation) : undefined;
			const qHint = q.hint ? String(q.hint) : undefined;
			const resolvedDiagram = resolveDiagram(
				q.associatedDiagramId,
				questionPage,
				qText,
				diagrams,
				qExplanation,
				qHint
			);
			const associatedDiagramId = resolvedDiagram?.diagramId;
			const associatedDiagramUrl = resolvedDiagram?.diagramUrl;

			if (outDiagnostics) {
				const cleanText = qText.replace(/\s+/g, ' ').trim();
				outDiagnostics.push({
					questionNumber: qNum,
					rawId: q.associatedDiagramId,
					resolvedId: associatedDiagramId,
					resolvedUrl: associatedDiagramUrl,
					matchedTier: resolvedDiagram?.matchedTier || 'Unlinked (No Diagram Associated)',
					questionPage,
					mentionsFigure: Boolean(resolvedDiagram?.mentionsFigure),
					questionTextSnippet:
						cleanText.length > 80 ? `${cleanText.substring(0, 80)}...` : cleanText,
				});
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
				pageNumber: questionPage,
			};
		});
}
