/**
 * Testify - Centralized Strict JSON Schema Definitions for Biphasic Similar Paper Generation
 */

import { Type } from '@google/genai';

/**
 * Google Gemini Structured Output Schema for Phase 1 Blueprint Extraction
 */
export const GEMINI_PAPER_BLUEPRINT_SCHEMA = {
	type: Type.OBJECT,
	properties: {
		paper_overview: {
			type: Type.OBJECT,
			properties: {
				description: {
					type: Type.STRING,
					description: 'Concise summary and synthesis of the source question paper',
				},
				target_student_profile: {
					type: Type.OBJECT,
					properties: {
						description: {
							type: Type.STRING,
							description: 'Description of the intended student profile and candidate level',
						},
						emphasized_abilities: {
							type: Type.ARRAY,
							description: 'List of specific cognitive abilities and forms of understanding tested',
							items: { type: Type.STRING },
						},
						reasoning: {
							type: Type.STRING,
							description: 'Evidence-based justification for the target student profile inference',
						},
					},
					required: ['description', 'emphasized_abilities', 'reasoning'],
				},
				overall_design_philosophy: {
					type: Type.STRING,
					description: 'The overarching pedagogical and examination design philosophy',
				},
				distinctive_characteristics: {
					type: Type.ARRAY,
					description: 'Key characteristics that distinguish this paper from a generic syllabus test',
					items: { type: Type.STRING },
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
			type: Type.OBJECT,
			properties: {
				subjects: {
					type: Type.ARRAY,
					description: 'Academic subjects covered',
					items: { type: Type.STRING },
				},
				topics: {
					type: Type.ARRAY,
					description: 'Core syllabus topics tested',
					items: { type: Type.STRING },
				},
				concept_distribution: {
					type: Type.ARRAY,
					description: 'Relative distribution and depth of key academic concepts',
					items: { type: Type.STRING },
				},
			},
			required: ['subjects', 'topics', 'concept_distribution'],
		},
		how_it_is_tested: {
			type: Type.OBJECT,
			properties: {
				question_construction: {
					type: Type.ARRAY,
					description: 'Patterns of question framing, stem formulation, and layout',
					items: { type: Type.STRING },
				},
				conceptual_application: {
					type: Type.ARRAY,
					description: 'How concepts must be identified, applied, or transformed',
					items: { type: Type.STRING },
				},
				reasoning_patterns: {
					type: Type.ARRAY,
					description: 'Patterns of multi-step, qualitative, or constraint-based reasoning',
					items: { type: Type.STRING },
				},
				mathematical_manipulation: {
					type: Type.ARRAY,
					description: 'Depth, fluency, and non-obvious algebraic/calculus demands',
					items: { type: Type.STRING },
				},
				information_interpretation: {
					type: Type.ARRAY,
					description: 'Interpretation of implicit vs explicit conditions, graphs, and scenarios',
					items: { type: Type.STRING },
				},
				visual_and_data_usage: {
					type: Type.ARRAY,
					description: 'Role of diagrams, circuit diagrams, tables, and data plots',
					items: { type: Type.STRING },
				},
				question_directness: {
					type: Type.ARRAY,
					description: 'Direct vs indirect principle identification patterns',
					items: { type: Type.STRING },
				},
				contextualization: {
					type: Type.ARRAY,
					description: 'Degree and nature of physical/real-world scenario contextualization',
					items: { type: Type.STRING },
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
			type: Type.OBJECT,
			properties: {
				observations: {
					type: Type.ARRAY,
					description: 'Direct factual observations from the paper',
					items: { type: Type.STRING },
				},
				strongly_inferred_intentions: {
					type: Type.ARRAY,
					description: 'Strongly supported inferences regarding the setter intent',
					items: { type: Type.STRING },
				},
				weakly_inferred_intentions: {
					type: Type.ARRAY,
					description: 'Plausible but tentative inferences regarding setter choices',
					items: { type: Type.STRING },
				},
			},
			required: ['observations', 'strongly_inferred_intentions', 'weakly_inferred_intentions'],
		},
		question_distribution: {
			type: Type.OBJECT,
			properties: {
				total_questions: {
					type: Type.INTEGER,
					description: 'Total number of questions analyzed in the paper',
				},
				archetypes: {
					type: Type.ARRAY,
					description: 'Distribution counts and percentages of identified archetypes',
					items: { type: Type.STRING },
				},
				conceptual_application_depth: {
					type: Type.ARRAY,
					description: 'Breakdown of conceptual application depths across questions',
					items: { type: Type.STRING },
				},
				single_vs_multi_concept: {
					type: Type.ARRAY,
					description: 'Distribution of single-concept vs multi-concept integration questions',
					items: { type: Type.STRING },
				},
				direct_vs_indirect_application: {
					type: Type.ARRAY,
					description: 'Distribution of direct vs indirect principle application',
					items: { type: Type.STRING },
				},
				qualitative_vs_quantitative_reasoning: {
					type: Type.ARRAY,
					description: 'Distribution of qualitative reasoning vs quantitative calculation questions',
					items: { type: Type.STRING },
				},
				visual_data_usage: {
					type: Type.ARRAY,
					description: 'Distribution of questions relying on figures, graphs, or visual data',
					items: { type: Type.STRING },
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
			type: Type.ARRAY,
			description: 'List of underlying recurring question archetypes',
			items: {
				type: Type.OBJECT,
				properties: {
					name: { type: Type.STRING, description: 'Descriptive archetype title' },
					description: { type: Type.STRING, description: 'Operational definition of the archetype' },
					count: { type: Type.INTEGER, description: 'Number of occurrences in the paper' },
					percentage: { type: Type.NUMBER, description: 'Percentage representation (0-100)' },
					representative_question_ids: {
						type: Type.ARRAY,
						description: 'Representative source question numbers or IDs',
						items: { type: Type.STRING },
					},
					what_is_tested: { type: Type.STRING, description: 'Knowledge or concept tested' },
					how_it_is_tested: {
						type: Type.STRING,
						description: 'Cognitive operations and reasoning required',
					},
					why_it_is_tested_this_way: {
						type: Type.STRING,
						description: 'Apparent pedagogical or evaluative purpose',
					},
					conceptual_application_depth: {
						type: Type.STRING,
						description: 'Specific depth and nature of conceptual application',
					},
					reasoning_pattern: {
						type: Type.STRING,
						description: 'Pattern of logical deductions and problem steps',
					},
					linguistic_pattern: {
						type: Type.STRING,
						description: 'Phrasing, terminology, and sentence framing style',
					},
					structural_pattern: {
						type: Type.STRING,
						description: 'Structure of the stem, constraints, and query request',
					},
					surface_form: {
						type: Type.STRING,
						description: 'Concrete surface appearance in the source paper',
					},
					deep_pattern: {
						type: Type.STRING,
						description: 'Abstracted generative pattern to reproduce',
					},
					generation_guidance: {
						type: Type.STRING,
						description: 'Actionable instructions for generating novel questions of this archetype',
					},
					anti_imitation_notes: {
						type: Type.STRING,
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
			type: Type.OBJECT,
			properties: {
				overall_style: { type: Type.STRING, description: 'Overall tone and prose register' },
				stem_length: { type: Type.STRING, description: 'Typical question stem length and brevity' },
				sentence_structure: {
					type: Type.STRING,
					description: 'Syntactic complexity and sentence structure patterns',
				},
				language_register: {
					type: Type.STRING,
					description: 'Formal, technical, minimal, or conversational register',
				},
				scenario_usage: {
					type: Type.STRING,
					description: 'Realistic vs artificial vs minimal scenario framing',
				},
				information_density: {
					type: Type.STRING,
					description: 'Concentration of essential vs contextual information',
				},
				explicitness: {
					type: Type.STRING,
					description: 'Directly stated vs unstated/inferred constraints',
				},
				technical_language: {
					type: Type.STRING,
					description: 'Precision and rigor of scientific/mathematical terminology',
				},
				numerical_style: {
					type: Type.STRING,
					description: 'Style of numerical values (convenient, natural, or fractional)',
				},
				recurring_linguistic_patterns: {
					type: Type.ARRAY,
					description: 'Common grammatical openers, phrasing clauses, and conventions',
					items: { type: Type.STRING },
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
			type: Type.ARRAY,
			description:
				'Analysis of diagnostic distractor design (common misconceptions, sign errors, boundary failures)',
			items: { type: Type.STRING },
		},
		sequencing_and_structure: {
			type: Type.OBJECT,
			properties: {
				section_structure: {
					type: Type.STRING,
					description: 'Sections, sections grouping, or overarching organizational layout',
				},
				ordering_patterns: {
					type: Type.ARRAY,
					description: 'Identified topic clustering or difficulty progression trends',
					items: { type: Type.STRING },
				},
				progression_patterns: {
					type: Type.ARRAY,
					description: 'Transitions between conceptual, computational, and synthesis questions',
					items: { type: Type.STRING },
				},
			},
			required: ['section_structure', 'ordering_patterns', 'progression_patterns'],
		},
		cross_question_patterns: {
			type: Type.ARRAY,
			description: 'Synthesized relationships, multi-angle concept tests, and recurring themes',
			items: { type: Type.STRING },
		},
		surface_vs_deep_patterns: {
			type: Type.ARRAY,
			description: 'Explicit mapping between superficial source details and deep generative patterns',
			items: {
				type: Type.OBJECT,
				properties: {
					surface_pattern: { type: Type.STRING, description: 'Superficial context or format' },
					deep_pattern: { type: Type.STRING, description: 'Underlying cognitive construction' },
					generation_instruction: {
						type: Type.STRING,
						description: 'Instruction for reproducing the deep pattern in new questions',
					},
				},
				required: ['surface_pattern', 'deep_pattern', 'generation_instruction'],
			},
		},
		distinctive_generation_rules: {
			type: Type.ARRAY,
			description:
				'High-priority rules that downstream generation must follow to capture the paper personality',
			items: { type: Type.STRING },
		},
		anti_imitation_constraints: {
			type: Type.ARRAY,
			description: 'Explicit list of quirks, exact numbers, and templates that must NOT be imitated',
			items: { type: Type.STRING },
		},
		uncertainties: {
			type: Type.ARRAY,
			description:
				'Areas where available paper evidence is insufficient to draw confident conclusions',
			items: { type: Type.STRING },
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
 * OpenAI Strict JSON Schema for Phase 1 Blueprint Extraction
 * (for response_format: { type: 'json_schema', strict: true })
 */
export const OPENAI_STRICT_PAPER_BLUEPRINT_SCHEMA = {
	type: 'json_schema' as const,
	json_schema: {
		name: 'paper_blueprint',
		strict: true,
		schema: {
			type: 'object',
			properties: {
				paper_overview: {
					type: 'object',
					properties: {
						description: { type: 'string' },
						target_student_profile: {
							type: 'object',
							properties: {
								description: { type: 'string' },
								emphasized_abilities: {
									type: 'array',
									items: { type: 'string' },
								},
								reasoning: { type: 'string' },
							},
							required: ['description', 'emphasized_abilities', 'reasoning'],
							additionalProperties: false,
						},
						overall_design_philosophy: { type: 'string' },
						distinctive_characteristics: {
							type: 'array',
							items: { type: 'string' },
						},
					},
					required: [
						'description',
						'target_student_profile',
						'overall_design_philosophy',
						'distinctive_characteristics',
					],
					additionalProperties: false,
				},
				what_is_tested: {
					type: 'object',
					properties: {
						subjects: {
							type: 'array',
							items: { type: 'string' },
						},
						topics: {
							type: 'array',
							items: { type: 'string' },
						},
						concept_distribution: {
							type: 'array',
							items: { type: 'string' },
						},
					},
					required: ['subjects', 'topics', 'concept_distribution'],
					additionalProperties: false,
				},
				how_it_is_tested: {
					type: 'object',
					properties: {
						question_construction: {
							type: 'array',
							items: { type: 'string' },
						},
						conceptual_application: {
							type: 'array',
							items: { type: 'string' },
						},
						reasoning_patterns: {
							type: 'array',
							items: { type: 'string' },
						},
						mathematical_manipulation: {
							type: 'array',
							items: { type: 'string' },
						},
						information_interpretation: {
							type: 'array',
							items: { type: 'string' },
						},
						visual_and_data_usage: {
							type: 'array',
							items: { type: 'string' },
						},
						question_directness: {
							type: 'array',
							items: { type: 'string' },
						},
						contextualization: {
							type: 'array',
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
					additionalProperties: false,
				},
				why_it_is_tested_this_way: {
					type: 'object',
					properties: {
						observations: {
							type: 'array',
							items: { type: 'string' },
						},
						strongly_inferred_intentions: {
							type: 'array',
							items: { type: 'string' },
						},
						weakly_inferred_intentions: {
							type: 'array',
							items: { type: 'string' },
						},
					},
					required: [
						'observations',
						'strongly_inferred_intentions',
						'weakly_inferred_intentions',
					],
					additionalProperties: false,
				},
				question_distribution: {
					type: 'object',
					properties: {
						total_questions: { type: 'number' },
						archetypes: {
							type: 'array',
							items: { type: 'string' },
						},
						conceptual_application_depth: {
							type: 'array',
							items: { type: 'string' },
						},
						single_vs_multi_concept: {
							type: 'array',
							items: { type: 'string' },
						},
						direct_vs_indirect_application: {
							type: 'array',
							items: { type: 'string' },
						},
						qualitative_vs_quantitative_reasoning: {
							type: 'array',
							items: { type: 'string' },
						},
						visual_data_usage: {
							type: 'array',
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
					additionalProperties: false,
				},
				question_archetypes: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							name: { type: 'string' },
							description: { type: 'string' },
							count: { type: 'number' },
							percentage: { type: 'number' },
							representative_question_ids: {
								type: 'array',
								items: { type: 'string' },
							},
							what_is_tested: { type: 'string' },
							how_it_is_tested: { type: 'string' },
							why_it_is_tested_this_way: { type: 'string' },
							conceptual_application_depth: { type: 'string' },
							reasoning_pattern: { type: 'string' },
							linguistic_pattern: { type: 'string' },
							structural_pattern: { type: 'string' },
							surface_form: { type: 'string' },
							deep_pattern: { type: 'string' },
							generation_guidance: { type: 'string' },
							anti_imitation_notes: { type: 'string' },
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
						additionalProperties: false,
					},
				},
				writing_style: {
					type: 'object',
					properties: {
						overall_style: { type: 'string' },
						stem_length: { type: 'string' },
						sentence_structure: { type: 'string' },
						language_register: { type: 'string' },
						scenario_usage: { type: 'string' },
						information_density: { type: 'string' },
						explicitness: { type: 'string' },
						technical_language: { type: 'string' },
						numerical_style: { type: 'string' },
						recurring_linguistic_patterns: {
							type: 'array',
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
					additionalProperties: false,
				},
				distractor_patterns: {
					type: 'array',
					items: { type: 'string' },
				},
				sequencing_and_structure: {
					type: 'object',
					properties: {
						section_structure: { type: 'string' },
						ordering_patterns: {
							type: 'array',
							items: { type: 'string' },
						},
						progression_patterns: {
							type: 'array',
							items: { type: 'string' },
						},
					},
					required: ['section_structure', 'ordering_patterns', 'progression_patterns'],
					additionalProperties: false,
				},
				cross_question_patterns: {
					type: 'array',
					items: { type: 'string' },
				},
				surface_vs_deep_patterns: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							surface_pattern: { type: 'string' },
							deep_pattern: { type: 'string' },
							generation_instruction: { type: 'string' },
						},
						required: ['surface_pattern', 'deep_pattern', 'generation_instruction'],
						additionalProperties: false,
					},
				},
				distinctive_generation_rules: {
					type: 'array',
					items: { type: 'string' },
				},
				anti_imitation_constraints: {
					type: 'array',
					items: { type: 'string' },
				},
				uncertainties: {
					type: 'array',
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
			additionalProperties: false,
		},
	},
};

/**
 * Anthropic Tool Definition for Phase 1 Blueprint Extraction Tool Calling
 */
export const ANTHROPIC_PAPER_BLUEPRINT_TOOL = {
	name: 'extract_paper_blueprint',
	description:
		'Extract the comprehensive structured paper blueprint reverse-engineering the exam design philosophy and question-construction patterns.',
	input_schema: {
		type: 'object' as const,
		properties: {
			paper_overview: {
				type: 'object',
				properties: {
					description: { type: 'string' },
					target_student_profile: {
						type: 'object',
						properties: {
							description: { type: 'string' },
							emphasized_abilities: {
								type: 'array',
								items: { type: 'string' },
							},
							reasoning: { type: 'string' },
						},
						required: ['description', 'emphasized_abilities', 'reasoning'],
					},
					overall_design_philosophy: { type: 'string' },
					distinctive_characteristics: {
						type: 'array',
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
						items: { type: 'string' },
					},
					topics: {
						type: 'array',
						items: { type: 'string' },
					},
					concept_distribution: {
						type: 'array',
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
						items: { type: 'string' },
					},
					conceptual_application: {
						type: 'array',
						items: { type: 'string' },
					},
					reasoning_patterns: {
						type: 'array',
						items: { type: 'string' },
					},
					mathematical_manipulation: {
						type: 'array',
						items: { type: 'string' },
					},
					information_interpretation: {
						type: 'array',
						items: { type: 'string' },
					},
					visual_and_data_usage: {
						type: 'array',
						items: { type: 'string' },
					},
					question_directness: {
						type: 'array',
						items: { type: 'string' },
					},
					contextualization: {
						type: 'array',
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
						items: { type: 'string' },
					},
					strongly_inferred_intentions: {
						type: 'array',
						items: { type: 'string' },
					},
					weakly_inferred_intentions: {
						type: 'array',
						items: { type: 'string' },
					},
				},
				required: [
					'observations',
					'strongly_inferred_intentions',
					'weakly_inferred_intentions',
				],
			},
			question_distribution: {
				type: 'object',
				properties: {
					total_questions: { type: 'number' },
					archetypes: {
						type: 'array',
						items: { type: 'string' },
					},
					conceptual_application_depth: {
						type: 'array',
						items: { type: 'string' },
					},
					single_vs_multi_concept: {
						type: 'array',
						items: { type: 'string' },
					},
					direct_vs_indirect_application: {
						type: 'array',
						items: { type: 'string' },
					},
					qualitative_vs_quantitative_reasoning: {
						type: 'array',
						items: { type: 'string' },
					},
					visual_data_usage: {
						type: 'array',
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
				items: {
					type: 'object',
					properties: {
						name: { type: 'string' },
						description: { type: 'string' },
						count: { type: 'number' },
						percentage: { type: 'number' },
						representative_question_ids: {
							type: 'array',
							items: { type: 'string' },
						},
						what_is_tested: { type: 'string' },
						how_it_is_tested: { type: 'string' },
						why_it_is_tested_this_way: { type: 'string' },
						conceptual_application_depth: { type: 'string' },
						reasoning_pattern: { type: 'string' },
						linguistic_pattern: { type: 'string' },
						structural_pattern: { type: 'string' },
						surface_form: { type: 'string' },
						deep_pattern: { type: 'string' },
						generation_guidance: { type: 'string' },
						anti_imitation_notes: { type: 'string' },
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
					overall_style: { type: 'string' },
					stem_length: { type: 'string' },
					sentence_structure: { type: 'string' },
					language_register: { type: 'string' },
					scenario_usage: { type: 'string' },
					information_density: { type: 'string' },
					explicitness: { type: 'string' },
					technical_language: { type: 'string' },
					numerical_style: { type: 'string' },
					recurring_linguistic_patterns: {
						type: 'array',
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
				items: { type: 'string' },
			},
			sequencing_and_structure: {
				type: 'object',
				properties: {
					section_structure: { type: 'string' },
					ordering_patterns: {
						type: 'array',
						items: { type: 'string' },
					},
					progression_patterns: {
						type: 'array',
						items: { type: 'string' },
					},
				},
				required: ['section_structure', 'ordering_patterns', 'progression_patterns'],
			},
			cross_question_patterns: {
				type: 'array',
				items: { type: 'string' },
			},
			surface_vs_deep_patterns: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						surface_pattern: { type: 'string' },
						deep_pattern: { type: 'string' },
						generation_instruction: { type: 'string' },
					},
					required: ['surface_pattern', 'deep_pattern', 'generation_instruction'],
				},
			},
			distinctive_generation_rules: {
				type: 'array',
				items: { type: 'string' },
			},
			anti_imitation_constraints: {
				type: 'array',
				items: { type: 'string' },
			},
			uncertainties: {
				type: 'array',
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
	},
};
