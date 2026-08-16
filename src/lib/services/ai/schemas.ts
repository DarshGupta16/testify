/**
 * Testify - Centralized Strict JSON Schema Definitions for Structured Outputs
 */

import { Type } from '@google/genai';

/**
 * Google Gemini Structured Output Schema (via @google/genai Schema Type)
 */
export const GEMINI_ASSESSMENT_SCHEMA = {
	type: Type.OBJECT,
	properties: {
		title: {
			type: Type.STRING,
			description: 'Title of the exam or assessment detected from headers',
		},
		subject: {
			type: Type.STRING,
			description:
				'Academic subject category: STEM, Computer Science, Humanities, Languages, or General',
		},
		instructions: {
			type: Type.STRING,
			description: 'General test instructions extracted or summarized from the document',
		},
		totalMarks: {
			type: Type.INTEGER,
			description: 'Total marks for the examination',
		},
		estimatedDurationMinutes: {
			type: Type.INTEGER,
			description: 'Estimated test duration in minutes',
		},
		questions: {
			type: Type.ARRAY,
			description: 'List of all extracted examination questions',
			items: {
				type: Type.OBJECT,
				properties: {
					questionNumber: {
						type: Type.INTEGER,
						description: 'Sequential question number (1, 2, 3, ...)',
					},
					type: {
						type: Type.STRING,
						enum: ['single_choice', 'multi_choice', 'numerical'],
						description: 'Strict question type classification',
					},
					text: {
						type: Type.STRING,
						description: 'Full question statement preserving LaTeX formulas',
					},
					options: {
						type: Type.ARRAY,
						description: 'List of multiple choice options for single_choice or multi_choice',
						items: {
							type: Type.OBJECT,
							properties: {
								id: {
									type: Type.STRING,
									description: 'Unique option identifier (e.g. opt_a, opt_b)',
								},
								text: {
									type: Type.STRING,
									description: 'Option label and statement preserving LaTeX math',
								},
							},
							required: ['id', 'text'],
						},
					},
					correctAnswer: {
						type: Type.STRING,
						description:
							'For single_choice: correct option ID; For numerical: calculated answer string',
					},
					correctAnswers: {
						type: Type.ARRAY,
						description: 'For multi_choice: array of all correct option IDs',
						items: { type: Type.STRING },
					},
					hint: {
						type: Type.STRING,
						description: 'Directional concept/formula hint for practice mode',
					},
					explanation: {
						type: Type.STRING,
						description: 'Step-by-step mathematical derivation and solution explanation',
					},
					marks: {
						type: Type.INTEGER,
						description: 'Positive marks awarded for correct response',
					},
					negativeMarks: {
						type: Type.INTEGER,
						description: 'Penalty marks deducted for incorrect response',
					},
					associatedDiagramId: {
						type: Type.STRING,
						description: 'ID of the matching extracted diagram crop (e.g. diag_p1_0) or null',
					},
					pageNumber: {
						type: Type.INTEGER,
						description: 'Page number in the document where the question appears',
					},
				},
				required: ['questionNumber', 'type', 'text', 'options', 'hint', 'explanation', 'marks'],
			},
		},
	},
	required: ['title', 'questions'],
};

/**
 * OpenAI Strict JSON Schema (for response_format: { type: 'json_schema', strict: true })
 */
export const OPENAI_STRICT_ASSESSMENT_SCHEMA = {
	type: 'json_schema' as const,
	json_schema: {
		name: 'testify_assessment',
		strict: true,
		schema: {
			type: 'object',
			properties: {
				title: { type: 'string' },
				subject: { type: 'string' },
				instructions: { type: 'string' },
				totalMarks: { type: 'number' },
				estimatedDurationMinutes: { type: 'number' },
				questions: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							questionNumber: { type: 'number' },
							type: {
								type: 'string',
								enum: ['single_choice', 'multi_choice', 'numerical'],
							},
							text: { type: 'string' },
							options: {
								type: 'array',
								items: {
									type: 'object',
									properties: {
										id: { type: 'string' },
										text: { type: 'string' },
									},
									required: ['id', 'text'],
									additionalProperties: false,
								},
							},
							correctAnswer: { type: ['string', 'null'] },
							correctAnswers: {
								type: 'array',
								items: { type: 'string' },
							},
							hint: { type: ['string', 'null'] },
							explanation: { type: ['string', 'null'] },
							marks: { type: 'number' },
							negativeMarks: { type: 'number' },
							associatedDiagramId: { type: ['string', 'null'] },
							pageNumber: { type: 'number' },
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
						additionalProperties: false,
					},
				},
			},
			required: [
				'title',
				'subject',
				'instructions',
				'totalMarks',
				'estimatedDurationMinutes',
				'questions',
			],
			additionalProperties: false,
		},
	},
};

/**
 * Anthropic Tool Definition for Forced Structured Output Tool Calling
 */
export const ANTHROPIC_ASSESSMENT_TOOL = {
	name: 'synthesize_assessment',
	description: 'Synthesize the structured test assessment schema from the test document.',
	input_schema: {
		type: 'object' as const,
		properties: {
			title: { type: 'string' },
			subject: { type: 'string' },
			instructions: { type: 'string' },
			totalMarks: { type: 'number' },
			estimatedDurationMinutes: { type: 'number' },
			questions: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						questionNumber: { type: 'number' },
						type: {
							type: 'string',
							enum: ['single_choice', 'multi_choice', 'numerical'],
						},
						text: { type: 'string' },
						options: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									id: { type: 'string' },
									text: { type: 'string' },
								},
								required: ['id', 'text'],
							},
						},
						correctAnswer: { type: 'string' },
						correctAnswers: {
							type: 'array',
							items: { type: 'string' },
						},
						hint: { type: 'string' },
						explanation: { type: 'string' },
						marks: { type: 'number' },
						negativeMarks: { type: 'number' },
						associatedDiagramId: { type: 'string' },
						pageNumber: { type: 'number' },
					},
					required: ['questionNumber', 'type', 'text', 'options', 'hint', 'explanation', 'marks'],
				},
			},
		},
		required: ['title', 'questions'],
	},
};
