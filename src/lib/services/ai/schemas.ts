/**
 * Testify - Centralized Strict JSON Schema Definitions for Structured Outputs
 */

import {
	toAnthropicTool,
	toGeminiSchema,
	toOpenAIStrictSchema,
} from './schemaTransformers';

/**
 * Canonical JSON Schema for Question Assessment Extraction.
 * Serves as the single source of truth for all AI providers (Gemini, OpenAI, Anthropic, Groq).
 */
export const ASSESSMENT_CANONICAL_SCHEMA: Record<string, unknown> = {
	type: 'object',
	properties: {
		title: {
			type: 'string',
			description: 'Title of the exam or assessment detected from headers',
		},
		instructions: {
			type: 'string',
			description: 'General test instructions extracted or summarized from the document',
		},
		totalMarks: {
			type: 'integer',
			description: 'Total marks for the examination',
		},
		estimatedDurationMinutes: {
			type: 'integer',
			description: 'Estimated test duration in minutes',
		},
		questions: {
			type: 'array',
			description: 'List of all extracted examination questions',
			items: {
				type: 'object',
				properties: {
					questionNumber: {
						type: 'integer',
						description: 'Sequential question number (1, 2, 3, ...)',
					},
					type: {
						type: 'string',
						enum: ['single_choice', 'multi_choice', 'numerical'],
						description: 'Strict question type classification',
					},
					text: {
						type: 'string',
						description: 'Full question statement preserving LaTeX formulas',
					},
					options: {
						type: 'array',
						description: 'List of multiple choice options for single_choice or multi_choice',
						items: {
							type: 'object',
							properties: {
								id: {
									type: 'string',
									description: 'Unique option identifier string (e.g. opt_k8v1, opt_m3b4)',
								},
								text: {
									type: 'string',
									description: 'Option label and statement preserving LaTeX math',
								},
							},
							required: ['id', 'text'],
						},
					},
					correctAnswer: {
						type: 'string',
						description:
							'For single_choice: correct option ID; For numerical: calculated answer string',
					},
					correctAnswers: {
						type: 'array',
						description: 'For multi_choice: array of all correct option IDs',
						items: { type: 'string' },
					},
					hint: {
						type: 'string',
						description: 'Directional concept/formula hint for practice mode',
					},
					explanation: {
						type: 'string',
						description: 'Step-by-step mathematical derivation and solution explanation',
					},
					marks: {
						type: 'integer',
						description: 'Positive marks awarded for correct response',
					},
					negativeMarks: {
						type: 'integer',
						description: 'Penalty marks deducted for incorrect response',
					},
					associatedDiagramId: {
						type: 'string',
						description:
							'Exact ID of the specific diagram crop strictly belonging to this question from the catalog (e.g. p1_diag_1), or null if the question has no dedicated diagram. NEVER attach full page scans or answer keys.',
					},
					pageNumber: {
						type: 'integer',
						description: 'Page number in the document where the question appears',
					},
				},
				required: [
					'questionNumber',
					'type',
					'text',
					'options',
					'correctAnswer',
					'correctAnswers',
					'hint',
					'explanation',
					'marks',
					'negativeMarks',
					'associatedDiagramId',
					'pageNumber',
				],
			},
		},
	},
	required: ['title', 'questions'],
};

/**
 * Google Gemini Structured Output Schema (via @google/genai Schema Type)
 */
export const GEMINI_ASSESSMENT_SCHEMA = toGeminiSchema(ASSESSMENT_CANONICAL_SCHEMA);

/**
 * OpenAI Strict JSON Schema (for response_format: { type: 'json_schema', strict: true })
 */
export const OPENAI_STRICT_ASSESSMENT_SCHEMA = toOpenAIStrictSchema(
	'assessment',
	ASSESSMENT_CANONICAL_SCHEMA
);

/**
 * OpenAI Schema alias for backward compatibility
 */
export const OPENAI_ASSESSMENT_SCHEMA = OPENAI_STRICT_ASSESSMENT_SCHEMA;

/**
 * Anthropic Tool Definition for Forced Structured Output Tool Calling
 */
export const ANTHROPIC_ASSESSMENT_TOOL = toAnthropicTool(
	'digitize_exam_paper',
	'Extracts complete examination assessment reverse-engineering questions, answer options, hints, explanations, diagrams, and metadata from the document.',
	ASSESSMENT_CANONICAL_SCHEMA
);

/**
 * Groq JSON Object Mode Schema
 */
export const GROQ_ASSESSMENT_SCHEMA = { type: 'json_object' as const };
