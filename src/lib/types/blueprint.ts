/**
 * Testify - Paper Blueprint Types & Schema Interfaces
 *
 * Defines the high-fidelity structural representation of an analyzed question paper
 * used during Biphasic Similar Paper Generation (Phase 1 Analysis -> Phase 2 Generation).
 */

export interface PaperOverview {
	description?: string;
	target_student_profile?: Record<string, unknown>;
	overall_design_philosophy?: string;
	distinctive_characteristics?: string[];
}

export interface WhatIsTested {
	subjects?: string[];
	topics?: string[];
	concept_distribution?: Array<string | Record<string, unknown>>;
}

export interface HowItIsTested {
	question_construction?: string[];
	conceptual_application?: string[];
	reasoning_patterns?: string[];
	mathematical_manipulation?: string[];
	information_interpretation?: string[];
	visual_and_data_usage?: string[];
	question_directness?: string[];
	contextualization?: string[];
}

export interface WhyItIsTestedThisWay {
	observations?: string[];
	strongly_inferred_intentions?: string[];
	weakly_inferred_intentions?: string[];
}

export interface QuestionDistribution {
	total_questions?: number;
	archetypes?: Array<string | Record<string, unknown>>;
	conceptual_application_depth?: Array<string | Record<string, unknown>>;
	single_vs_multi_concept?: Array<string | Record<string, unknown>>;
	direct_vs_indirect_application?: Array<string | Record<string, unknown>>;
	qualitative_vs_quantitative_reasoning?: Array<string | Record<string, unknown>>;
	visual_data_usage?: Array<string | Record<string, unknown>>;
}

export interface QuestionArchetype {
	name: string;
	description?: string;
	count?: number;
	percentage?: number;
	representative_question_ids?: Array<string | number>;
	what_is_tested?: string;
	how_it_is_tested?: string;
	why_it_is_tested_this_way?: string;
	conceptual_application_depth?: string;
	reasoning_pattern?: string;
	linguistic_pattern?: string;
	structural_pattern?: string;
	surface_form?: string;
	deep_pattern?: string;
	generation_guidance?: string;
	anti_imitation_notes?: string;
}

export interface WritingStyle {
	overall_style?: string;
	stem_length?: string;
	sentence_structure?: string;
	language_register?: string;
	scenario_usage?: string;
	information_density?: string;
	explicitness?: string;
	technical_language?: string;
	numerical_style?: string;
	recurring_linguistic_patterns?: string[];
}

export interface SequencingAndStructure {
	section_structure?: string;
	ordering_patterns?: string[];
	progression_patterns?: string[];
}

export interface SurfaceVsDeepPattern {
	surface_pattern?: string;
	deep_pattern?: string;
	generation_instruction?: string;
}

export interface PaperBlueprint {
	paper_overview?: PaperOverview;
	what_is_tested?: WhatIsTested;
	how_it_is_tested?: HowItIsTested;
	why_it_is_tested_this_way?: WhyItIsTestedThisWay;
	question_distribution?: QuestionDistribution;
	question_archetypes?: QuestionArchetype[];
	writing_style?: WritingStyle;
	distractor_patterns?: Array<string | Record<string, unknown>>;
	sequencing_and_structure?: SequencingAndStructure;
	cross_question_patterns?: Array<string | Record<string, unknown>>;
	surface_vs_deep_patterns?: SurfaceVsDeepPattern[];
	distinctive_generation_rules?: string[];
	anti_imitation_constraints?: string[];
	uncertainties?: string[];
	rawBlueprintText?: string;
}
