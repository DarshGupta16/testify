/**
 * Testify - Centralized Strict JSON Schema Definitions for Biphasic Similar Paper Generation
 */

import {
	toAnthropicTool,
	toGeminiSchema,
	toOpenAIStrictSchema,
} from './schemaTransformers';

/**
 * Canonical JSON Schema for Phase 1 Blueprint Extraction.
 * Serves as the single source of truth across all AI providers (Gemini, OpenAI, Anthropic, Groq).
 */
export const PAPER_BLUEPRINT_CANONICAL_SCHEMA: Record<string, unknown> = {
	type: 'object',
	properties: {
		paper_overview: {
			type: 'object',
			properties: {
				description: {
					type: 'string',
					description: 'Concise summary and synthesis of the source question paper',
				},
				target_student_profile: {
					type: 'object',
					properties: {
						description: {
							type: 'string',
							description: 'Description of the intended student profile and candidate level',
						},
						emphasized_abilities: {
							type: 'array',
							description: 'List of specific cognitive abilities and forms of understanding tested',
							items: { type: 'string' },
						},
						reasoning: {
							type: 'string',
							description: 'Evidence-based justification for the target student profile inference',
						},
					},
					required: ['description', 'emphasized_abilities', 'reasoning'],
				},
				overall_design_philosophy: {
					type: 'string',
					description: 'The overarching pedagogical and examination design philosophy',
				},
				distinctive_characteristics: {
					type: 'array',
					description: 'Key characteristics that distinguish this paper from a generic syllabus test',
					items: { type: 'string' },
				},
			},
			required: [
				'description',
				'target_student_profile',
				'overall_design_philosophy',
				'distinctive_characteristics',
			],
		},
		what_is_tested: {
			type: 'object',
			properties: {
				subjects: {
					type: 'array',
					description: 'Academic subjects covered',
					items: { type: 'string' },
				},
				topics: {
					type: 'array',
					description: 'Core syllabus topics tested',
					items: { type: 'string' },
				},
				concept_distribution: {
					type: 'array',
					description: 'Relative distribution and depth of key academic concepts',
					items: { type: 'string' },
				},
			},
			required: ['subjects', 'topics', 'concept_distribution'],
		},
		how_it_is_tested: {
			type: 'object',
			properties: {
				question_construction: {
					type: 'array',
					description: 'Patterns of question framing, stem formulation, and layout',
					items: { type: 'string' },
				},
				conceptual_application: {
					type: 'array',
					description: 'How concepts must be identified, applied, or transformed',
					items: { type: 'string' },
				},
				reasoning_patterns: {
					type: 'array',
					description: 'Patterns of multi-step, qualitative, or constraint-based reasoning',
					items: { type: 'string' },
				},
				mathematical_manipulation: {
					type: 'array',
					description: 'Depth, fluency, and non-obvious algebraic/calculus demands',
					items: { type: 'string' },
				},
				information_interpretation: {
					type: 'array',
					description: 'Interpretation of implicit vs explicit conditions, graphs, and scenarios',
					items: { type: 'string' },
				},
				visual_and_data_usage: {
					type: 'array',
					description: 'Role of diagrams, circuit diagrams, tables, and data plots',
					items: { type: 'string' },
				},
				question_directness: {
					type: 'array',
					description: 'Direct vs indirect principle identification patterns',
					items: { type: 'string' },
				},
				contextualization: {
					type: 'array',
					description: 'Degree and nature of physical/real-world scenario contextualization',
					items: { type: 'string' },
				},
			},
			required: [
				'question_construction',
				'conceptual_application',
				'reasoning_patterns',
				'mathematical_manipulation',
				'information_interpretation',
				'visual_and_data_usage',
				'question_directness',
				'contextualization',
			],
		},
		why_it_is_tested_this_way: {
			type: 'object',
			properties: {
				observations: {
					type: 'array',
					description: 'Direct factual observations from the paper',
					items: { type: 'string' },
				},
				strongly_inferred_intentions: {
					type: 'array',
					description: 'Strongly supported inferences regarding the setter intent',
					items: { type: 'string' },
				},
				weakly_inferred_intentions: {
					type: 'array',
					description: 'Plausible but tentative inferences regarding setter choices',
					items: { type: 'string' },
				},
			},
			required: ['observations', 'strongly_inferred_intentions', 'weakly_inferred_intentions'],
		},
		question_distribution: {
			type: 'object',
			properties: {
				total_questions: {
					type: 'integer',
					description: 'Total number of questions analyzed in the paper',
				},
				archetypes: {
					type: 'array',
					description: 'Distribution counts and percentages of identified archetypes',
					items: { type: 'string' },
				},
				conceptual_application_depth: {
					type: 'array',
					description: 'Breakdown of conceptual application depths across questions',
					items: { type: 'string' },
				},
				single_vs_multi_concept: {
					type: 'array',
					description: 'Distribution of single-concept vs multi-concept integration questions',
					items: { type: 'string' },
				},
				direct_vs_indirect_application: {
					type: 'array',
					description: 'Distribution of direct vs indirect principle application',
					items: { type: 'string' },
				},
				qualitative_vs_quantitative_reasoning: {
					type: 'array',
					description: 'Distribution of qualitative reasoning vs quantitative calculation questions',
					items: { type: 'string' },
				},
				visual_data_usage: {
					type: 'array',
					description: 'Distribution of questions relying on figures, graphs, or visual data',
					items: { type: 'string' },
				},
			},
			required: [
				'total_questions',
				'archetypes',
				'conceptual_application_depth',
				'single_vs_multi_concept',
				'direct_vs_indirect_application',
				'qualitative_vs_quantitative_reasoning',
				'visual_data_usage',
			],
		},
		question_archetypes: {
			type: 'array',
			description: 'List of underlying recurring question archetypes',
			items: {
				type: 'object',
				properties: {
					name: { type: 'string', description: 'Descriptive archetype title' },
					description: { type: 'string', description: 'Operational definition of the archetype' },
					count: { type: 'integer', description: 'Number of occurrences in the paper' },
					percentage: { type: 'number', description: 'Percentage representation (0-100)' },
					representative_question_ids: {
						type: 'array',
						description: 'Representative source question numbers or IDs',
						items: { type: 'string' },
					},
					what_is_tested: { type: 'string', description: 'Knowledge or concept tested' },
					how_it_is_tested: {
						type: 'string',
						description: 'Cognitive operations and reasoning required',
					},
					why_it_is_tested_this_way: {
						type: 'string',
						description: 'Apparent pedagogical or evaluative purpose',
					},
					conceptual_application_depth: {
						type: 'string',
						description: 'Specific depth and nature of conceptual application',
					},
					reasoning_pattern: {
						type: 'string',
						description: 'Pattern of logical deductions and problem steps',
					},
					linguistic_pattern: {
						type: 'string',
						description: 'Phrasing, terminology, and sentence framing style',
					},
					structural_pattern: {
						type: 'string',
						description: 'Structure of the stem, constraints, and query request',
					},
					surface_form: {
						type: 'string',
						description: 'Concrete surface appearance in the source paper',
					},
					deep_pattern: {
						type: 'string',
						description: 'Abstracted generative pattern to reproduce',
					},
					generation_guidance: {
						type: 'string',
						description: 'Actionable instructions for generating novel questions of this archetype',
					},
					anti_imitation_notes: {
						type: 'string',
						description: 'Superficial templates, numbers, and quirks that must NOT be copied',
					},
				},
				required: [
					'name',
					'description',
					'count',
					'percentage',
					'representative_question_ids',
					'what_is_tested',
					'how_it_is_tested',
					'why_it_is_tested_this_way',
					'conceptual_application_depth',
					'reasoning_pattern',
					'linguistic_pattern',
					'structural_pattern',
					'surface_form',
					'deep_pattern',
					'generation_guidance',
					'anti_imitation_notes',
				],
			},
		},
		writing_style: {
			type: 'object',
			properties: {
				overall_style: { type: 'string', description: 'Overall tone and prose register' },
				stem_length: { type: 'string', description: 'Typical question stem length and brevity' },
				sentence_structure: {
					type: 'string',
					description: 'Syntactic complexity and sentence structure patterns',
				},
				language_register: {
					type: 'string',
					description: 'Formal, technical, minimal, or conversational register',
				},
				scenario_usage: {
					type: 'string',
					description: 'Realistic vs artificial vs minimal scenario framing',
				},
				information_density: {
					type: 'string',
					description: 'Concentration of essential vs contextual information',
				},
				explicitness: {
					type: 'string',
					description: 'Directly stated vs unstated/inferred constraints',
				},
				technical_language: {
					type: 'string',
					description: 'Precision and rigor of scientific/mathematical terminology',
				},
				numerical_style: {
					type: 'string',
					description: 'Style of numerical values (convenient, natural, or fractional)',
				},
				recurring_linguistic_patterns: {
					type: 'array',
					description: 'Common grammatical openers, phrasing clauses, and conventions',
					items: { type: 'string' },
				},
			},
			required: [
				'overall_style',
				'stem_length',
				'sentence_structure',
				'language_register',
				'scenario_usage',
				'information_density',
				'explicitness',
				'technical_language',
				'numerical_style',
				'recurring_linguistic_patterns',
			],
		},
		distractor_patterns: {
			type: 'array',
			description:
				'Analysis of diagnostic distractor design (common misconceptions, sign errors, boundary failures)',
			items: { type: 'string' },
		},
		sequencing_and_structure: {
			type: 'object',
			properties: {
				section_structure: {
					type: 'string',
					description: 'Sections, sections grouping, or overarching organizational layout',
				},
				ordering_patterns: {
					type: 'array',
					description: 'Identified topic clustering or difficulty progression trends',
					items: { type: 'string' },
				},
				progression_patterns: {
					type: 'array',
					description: 'Transitions between conceptual, computational, and synthesis questions',
					items: { type: 'string' },
				},
			},
			required: ['section_structure', 'ordering_patterns', 'progression_patterns'],
		},
		cross_question_patterns: {
			type: 'array',
			description: 'Synthesized relationships, multi-angle concept tests, and recurring themes',
			items: { type: 'string' },
		},
		surface_vs_deep_patterns: {
			type: 'array',
			description: 'Explicit mapping between superficial source details and deep generative patterns',
			items: {
				type: 'object',
				properties: {
					surface_pattern: { type: 'string', description: 'Superficial context or format' },
					deep_pattern: { type: 'string', description: 'Underlying cognitive construction' },
					generation_instruction: {
						type: 'string',
						description: 'Instruction for reproducing the deep pattern in new questions',
					},
				},
				required: ['surface_pattern', 'deep_pattern', 'generation_instruction'],
			},
		},
		distinctive_generation_rules: {
			type: 'array',
			description:
				'High-priority rules that downstream generation must follow to capture the paper personality',
			items: { type: 'string' },
		},
		anti_imitation_constraints: {
			type: 'array',
			description: 'Explicit list of quirks, exact numbers, and templates that must NOT be imitated',
			items: { type: 'string' },
		},
		uncertainties: {
			type: 'array',
			description:
				'Areas where available paper evidence is insufficient to draw confident conclusions',
			items: { type: 'string' },
		},
	},
	required: [
		'paper_overview',
		'what_is_tested',
		'how_it_is_tested',
		'why_it_is_tested_this_way',
		'question_distribution',
		'question_archetypes',
		'writing_style',
		'distractor_patterns',
		'sequencing_and_structure',
		'cross_question_patterns',
		'surface_vs_deep_patterns',
		'distinctive_generation_rules',
		'anti_imitation_constraints',
		'uncertainties',
	],
};

/**
 * Google Gemini Structured Output Schema for Phase 1 Blueprint Extraction
 */
export const GEMINI_PAPER_BLUEPRINT_SCHEMA = toGeminiSchema(PAPER_BLUEPRINT_CANONICAL_SCHEMA);

/**
 * OpenAI Strict JSON Schema for Phase 1 Blueprint Extraction
 * (for response_format: { type: 'json_schema', strict: true })
 */
export const OPENAI_STRICT_PAPER_BLUEPRINT_SCHEMA = toOpenAIStrictSchema(
	'paper_blueprint',
	PAPER_BLUEPRINT_CANONICAL_SCHEMA
);

/**
 * OpenAI Schema alias for backward compatibility
 */
export const OPENAI_PAPER_BLUEPRINT_SCHEMA = OPENAI_STRICT_PAPER_BLUEPRINT_SCHEMA;

/**
 * Anthropic Tool Definition for Phase 1 Blueprint Extraction Tool Calling
 */
export const ANTHROPIC_PAPER_BLUEPRINT_TOOL = toAnthropicTool(
	'extract_paper_blueprint',
	'Extract the comprehensive structured paper blueprint reverse-engineering the exam design philosophy and question-construction patterns.',
	PAPER_BLUEPRINT_CANONICAL_SCHEMA
);

/**
 * Groq JSON Object Mode Schema for Blueprint Extraction
 */
export const GROQ_PAPER_BLUEPRINT_SCHEMA = { type: 'json_object' as const };
