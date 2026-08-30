/**
 * Testify - AI Paper Blueprint Parsing & Normalization Service
 */

import type { PaperBlueprint } from '$lib/types/blueprint';
import { cleanRawJsonText, sanitizeLatexInJson } from './parsers';

/**
 * Safely parses and normalizes a raw LLM text response into a guaranteed PaperBlueprint object.
 */
export function parsePaperBlueprint(rawText: string): PaperBlueprint {
	const cleaned = cleanRawJsonText(rawText);
	const sanitized = sanitizeLatexInJson(cleaned);

	let parsed: any;
	try {
		parsed = JSON.parse(sanitized);
	} catch (primaryErr) {
		try {
			const escapedLatex = cleaned.replace(/(?<!\\)\\(?!["\\/bfnrtu]|u[0-9a-fA-F]{4})/g, '\\\\');
			parsed = JSON.parse(escapedLatex);
		} catch {
			console.error('[AI Blueprint Parser] JSON Parse Error:', primaryErr, '\nRaw text:\n', rawText);
			throw new Error(
				`Failed to parse Paper Blueprint from AI model response: ${(primaryErr as Error).message}`
			);
		}
	}

	if (typeof parsed !== 'object' || parsed === null) {
		throw new Error('Parsed Paper Blueprint response is not a valid JSON object');
	}

	return {
		paper_overview: {
			description: typeof parsed.paper_overview?.description === 'string' ? parsed.paper_overview.description : '',
			target_student_profile: {
				description:
					typeof parsed.paper_overview?.target_student_profile?.description === 'string'
						? parsed.paper_overview.target_student_profile.description
						: '',
				emphasized_abilities: Array.isArray(
					parsed.paper_overview?.target_student_profile?.emphasized_abilities
				)
					? parsed.paper_overview.target_student_profile.emphasized_abilities.map(String)
					: [],
				reasoning:
					typeof parsed.paper_overview?.target_student_profile?.reasoning === 'string'
						? parsed.paper_overview.target_student_profile.reasoning
						: '',
			},
			overall_design_philosophy:
				typeof parsed.paper_overview?.overall_design_philosophy === 'string'
					? parsed.paper_overview.overall_design_philosophy
					: '',
			distinctive_characteristics: Array.isArray(parsed.paper_overview?.distinctive_characteristics)
				? parsed.paper_overview.distinctive_characteristics.map(String)
				: [],
		},
		what_is_tested: {
			subjects: Array.isArray(parsed.what_is_tested?.subjects)
				? parsed.what_is_tested.subjects.map(String)
				: [],
			topics: Array.isArray(parsed.what_is_tested?.topics)
				? parsed.what_is_tested.topics.map(String)
				: [],
			concept_distribution: Array.isArray(parsed.what_is_tested?.concept_distribution)
				? parsed.what_is_tested.concept_distribution.map(String)
				: [],
		},
		how_it_is_tested: {
			question_construction: Array.isArray(parsed.how_it_is_tested?.question_construction)
				? parsed.how_it_is_tested.question_construction.map(String)
				: [],
			conceptual_application: Array.isArray(parsed.how_it_is_tested?.conceptual_application)
				? parsed.how_it_is_tested.conceptual_application.map(String)
				: [],
			reasoning_patterns: Array.isArray(parsed.how_it_is_tested?.reasoning_patterns)
				? parsed.how_it_is_tested.reasoning_patterns.map(String)
				: [],
			mathematical_manipulation: Array.isArray(parsed.how_it_is_tested?.mathematical_manipulation)
				? parsed.how_it_is_tested.mathematical_manipulation.map(String)
				: [],
			information_interpretation: Array.isArray(parsed.how_it_is_tested?.information_interpretation)
				? parsed.how_it_is_tested.information_interpretation.map(String)
				: [],
			visual_and_data_usage: Array.isArray(parsed.how_it_is_tested?.visual_and_data_usage)
				? parsed.how_it_is_tested.visual_and_data_usage.map(String)
				: [],
			question_directness: Array.isArray(parsed.how_it_is_tested?.question_directness)
				? parsed.how_it_is_tested.question_directness.map(String)
				: [],
			contextualization: Array.isArray(parsed.how_it_is_tested?.contextualization)
				? parsed.how_it_is_tested.contextualization.map(String)
				: [],
		},
		why_it_is_tested_this_way: {
			observations: Array.isArray(parsed.why_it_is_tested_this_way?.observations)
				? parsed.why_it_is_tested_this_way.observations.map(String)
				: [],
			strongly_inferred_intentions: Array.isArray(
				parsed.why_it_is_tested_this_way?.strongly_inferred_intentions
			)
				? parsed.why_it_is_tested_this_way.strongly_inferred_intentions.map(String)
				: [],
			weakly_inferred_intentions: Array.isArray(
				parsed.why_it_is_tested_this_way?.weakly_inferred_intentions
			)
				? parsed.why_it_is_tested_this_way.weakly_inferred_intentions.map(String)
				: [],
		},
		question_distribution: {
			total_questions:
				typeof parsed.question_distribution?.total_questions === 'number'
					? parsed.question_distribution.total_questions
					: Array.isArray(parsed.question_archetypes)
						? parsed.question_archetypes.reduce(
								(sum: number, a: any) => sum + (typeof a.count === 'number' ? a.count : 0),
								0
							)
						: 0,
			archetypes: Array.isArray(parsed.question_distribution?.archetypes)
				? parsed.question_distribution.archetypes.map(String)
				: [],
			conceptual_application_depth: Array.isArray(
				parsed.question_distribution?.conceptual_application_depth
			)
				? parsed.question_distribution.conceptual_application_depth.map(String)
				: [],
			single_vs_multi_concept: Array.isArray(parsed.question_distribution?.single_vs_multi_concept)
				? parsed.question_distribution.single_vs_multi_concept.map(String)
				: [],
			direct_vs_indirect_application: Array.isArray(
				parsed.question_distribution?.direct_vs_indirect_application
			)
				? parsed.question_distribution.direct_vs_indirect_application.map(String)
				: [],
			qualitative_vs_quantitative_reasoning: Array.isArray(
				parsed.question_distribution?.qualitative_vs_quantitative_reasoning
			)
				? parsed.question_distribution.qualitative_vs_quantitative_reasoning.map(String)
				: [],
			visual_data_usage: Array.isArray(parsed.question_distribution?.visual_data_usage)
				? parsed.question_distribution.visual_data_usage.map(String)
				: [],
		},
		question_archetypes: Array.isArray(parsed.question_archetypes)
			? parsed.question_archetypes.map((a: any) => ({
					name: typeof a.name === 'string' ? a.name : '',
					description: typeof a.description === 'string' ? a.description : '',
					count: typeof a.count === 'number' ? a.count : 0,
					percentage: typeof a.percentage === 'number' ? a.percentage : 0,
					representative_question_ids: Array.isArray(a.representative_question_ids)
						? a.representative_question_ids.map(String)
						: [],
					what_is_tested: typeof a.what_is_tested === 'string' ? a.what_is_tested : '',
					how_it_is_tested: typeof a.how_it_is_tested === 'string' ? a.how_it_is_tested : '',
					why_it_is_tested_this_way:
						typeof a.why_it_is_tested_this_way === 'string' ? a.why_it_is_tested_this_way : '',
					conceptual_application_depth:
						typeof a.conceptual_application_depth === 'string'
							? a.conceptual_application_depth
							: '',
					reasoning_pattern: typeof a.reasoning_pattern === 'string' ? a.reasoning_pattern : '',
					linguistic_pattern: typeof a.linguistic_pattern === 'string' ? a.linguistic_pattern : '',
					structural_pattern: typeof a.structural_pattern === 'string' ? a.structural_pattern : '',
					surface_form: typeof a.surface_form === 'string' ? a.surface_form : '',
					deep_pattern: typeof a.deep_pattern === 'string' ? a.deep_pattern : '',
					generation_guidance:
						typeof a.generation_guidance === 'string' ? a.generation_guidance : '',
					anti_imitation_notes:
						typeof a.anti_imitation_notes === 'string' ? a.anti_imitation_notes : '',
				}))
			: [],
		writing_style: {
			overall_style: typeof parsed.writing_style?.overall_style === 'string' ? parsed.writing_style.overall_style : '',
			stem_length: typeof parsed.writing_style?.stem_length === 'string' ? parsed.writing_style.stem_length : '',
			sentence_structure:
				typeof parsed.writing_style?.sentence_structure === 'string'
					? parsed.writing_style.sentence_structure
					: '',
			language_register:
				typeof parsed.writing_style?.language_register === 'string'
					? parsed.writing_style.language_register
					: '',
			scenario_usage:
				typeof parsed.writing_style?.scenario_usage === 'string' ? parsed.writing_style.scenario_usage : '',
			information_density:
				typeof parsed.writing_style?.information_density === 'string'
					? parsed.writing_style.information_density
					: '',
			explicitness:
				typeof parsed.writing_style?.explicitness === 'string' ? parsed.writing_style.explicitness : '',
			technical_language:
				typeof parsed.writing_style?.technical_language === 'string'
					? parsed.writing_style.technical_language
					: '',
			numerical_style:
				typeof parsed.writing_style?.numerical_style === 'string' ? parsed.writing_style.numerical_style : '',
			recurring_linguistic_patterns: Array.isArray(
				parsed.writing_style?.recurring_linguistic_patterns
			)
				? parsed.writing_style.recurring_linguistic_patterns.map(String)
				: [],
		},
		distractor_patterns: Array.isArray(parsed.distractor_patterns)
			? parsed.distractor_patterns.map(String)
			: [],
		sequencing_and_structure: {
			section_structure:
				typeof parsed.sequencing_and_structure?.section_structure === 'string'
					? parsed.sequencing_and_structure.section_structure
					: '',
			ordering_patterns: Array.isArray(parsed.sequencing_and_structure?.ordering_patterns)
				? parsed.sequencing_and_structure.ordering_patterns.map(String)
				: [],
			progression_patterns: Array.isArray(parsed.sequencing_and_structure?.progression_patterns)
				? parsed.sequencing_and_structure.progression_patterns.map(String)
				: [],
		},
		cross_question_patterns: Array.isArray(parsed.cross_question_patterns)
			? parsed.cross_question_patterns.map(String)
			: [],
		surface_vs_deep_patterns: Array.isArray(parsed.surface_vs_deep_patterns)
			? parsed.surface_vs_deep_patterns.map((p: any) => ({
					surface_pattern: typeof p.surface_pattern === 'string' ? p.surface_pattern : '',
					deep_pattern: typeof p.deep_pattern === 'string' ? p.deep_pattern : '',
					generation_instruction:
						typeof p.generation_instruction === 'string' ? p.generation_instruction : '',
				}))
			: [],
		distinctive_generation_rules: Array.isArray(parsed.distinctive_generation_rules)
			? parsed.distinctive_generation_rules.map(String)
			: [],
		anti_imitation_constraints: Array.isArray(parsed.anti_imitation_constraints)
			? parsed.anti_imitation_constraints.map(String)
			: [],
		uncertainties: Array.isArray(parsed.uncertainties) ? parsed.uncertainties.map(String) : [],
	};
}
