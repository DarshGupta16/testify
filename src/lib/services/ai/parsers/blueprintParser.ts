/**
 * Testify - AI Paper Blueprint Parsing & Normalization Service
 */

import type { PaperBlueprint } from '$lib/types/blueprint';
import { cleanRawJsonText, sanitizeLatexInJson } from './parsers';

function isRecord(val: unknown): val is Record<string, unknown> {
	return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function parseSafeNumber(val: unknown, fallback = 0): number {
	if (typeof val === 'number' && !Number.isNaN(val)) return val;
	if (typeof val === 'string') {
		const parsed = Number.parseFloat(val);
		return Number.isNaN(parsed) ? fallback : parsed;
	}
	return fallback;
}

function safeStringArray(val: unknown): string[] {
	if (!Array.isArray(val)) return [];
	return val
		.map((item) => {
			if (typeof item === 'string') return item.trim();
			if (typeof item === 'number' || typeof item === 'boolean') return String(item);
			if (isRecord(item)) {
				if (typeof item.text === 'string') return item.text;
				if (typeof item.description === 'string') return item.description;
				if (typeof item.name === 'string') return item.name;
				return Object.entries(item)
					.map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
					.join(' - ');
			}
			return '';
		})
		.filter((s) => s.length > 0);
}

/**
 * Safely parses and normalizes a raw LLM text response into a guaranteed PaperBlueprint object.
 */
export function parsePaperBlueprint(rawText: string): PaperBlueprint {
	const cleaned = cleanRawJsonText(rawText);
	const sanitized = sanitizeLatexInJson(cleaned);

	let parsed: unknown;
	try {
		parsed = JSON.parse(sanitized);
	} catch (primaryErr) {
		try {
			let fallbackText = sanitizeLatexInJson(cleaned);
			fallbackText = fallbackText.replace(/(?<!\\)\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
			parsed = JSON.parse(fallbackText);
		} catch {
			console.error(
				'[AI Blueprint Parser] JSON Parse Error:',
				primaryErr,
				'\nRaw text:\n',
				rawText
			);
			const message = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
			throw new Error(`Failed to parse Paper Blueprint from AI model response: ${message}`);
		}
	}

	if (!isRecord(parsed)) {
		throw new Error('Parsed Paper Blueprint response is not a valid JSON object');
	}

	const paperOverview = isRecord(parsed.paper_overview) ? parsed.paper_overview : {};
	const targetStudentProfile = isRecord(paperOverview.target_student_profile)
		? paperOverview.target_student_profile
		: {};

	const whatIsTested = isRecord(parsed.what_is_tested) ? parsed.what_is_tested : {};
	const howItIsTested = isRecord(parsed.how_it_is_tested) ? parsed.how_it_is_tested : {};
	const whyItIsTestedThisWay = isRecord(parsed.why_it_is_tested_this_way)
		? parsed.why_it_is_tested_this_way
		: {};
	const questionDistribution = isRecord(parsed.question_distribution)
		? parsed.question_distribution
		: {};
	const writingStyle = isRecord(parsed.writing_style) ? parsed.writing_style : {};
	const sequencingAndStructure = isRecord(parsed.sequencing_and_structure)
		? parsed.sequencing_and_structure
		: {};

	const questionArchetypesRaw = Array.isArray(parsed.question_archetypes)
		? parsed.question_archetypes.filter(isRecord)
		: [];

	const surfaceVsDeepPatternsRaw = Array.isArray(parsed.surface_vs_deep_patterns)
		? parsed.surface_vs_deep_patterns.filter(isRecord)
		: [];

	return {
		paper_overview: {
			description: typeof paperOverview.description === 'string' ? paperOverview.description : '',
			target_student_profile: {
				description:
					typeof targetStudentProfile.description === 'string'
						? targetStudentProfile.description
						: '',
				emphasized_abilities: safeStringArray(targetStudentProfile.emphasized_abilities),
				reasoning:
					typeof targetStudentProfile.reasoning === 'string' ? targetStudentProfile.reasoning : '',
			},
			overall_design_philosophy:
				typeof paperOverview.overall_design_philosophy === 'string'
					? paperOverview.overall_design_philosophy
					: '',
			distinctive_characteristics: safeStringArray(paperOverview.distinctive_characteristics),
		},
		what_is_tested: {
			subjects: safeStringArray(whatIsTested.subjects),
			topics: safeStringArray(whatIsTested.topics),
			concept_distribution: safeStringArray(whatIsTested.concept_distribution),
		},
		how_it_is_tested: {
			question_construction: safeStringArray(howItIsTested.question_construction),
			conceptual_application: safeStringArray(howItIsTested.conceptual_application),
			reasoning_patterns: safeStringArray(howItIsTested.reasoning_patterns),
			mathematical_manipulation: safeStringArray(howItIsTested.mathematical_manipulation),
			information_interpretation: safeStringArray(howItIsTested.information_interpretation),
			visual_and_data_usage: safeStringArray(howItIsTested.visual_and_data_usage),
			question_directness: safeStringArray(howItIsTested.question_directness),
			contextualization: safeStringArray(howItIsTested.contextualization),
		},
		why_it_is_tested_this_way: {
			observations: safeStringArray(whyItIsTestedThisWay.observations),
			strongly_inferred_intentions: safeStringArray(
				whyItIsTestedThisWay.strongly_inferred_intentions
			),
			weakly_inferred_intentions: safeStringArray(whyItIsTestedThisWay.weakly_inferred_intentions),
		},
		question_distribution: {
			total_questions: parseSafeNumber(
				questionDistribution.total_questions,
				questionArchetypesRaw.reduce((sum: number, a) => sum + parseSafeNumber(a.count, 0), 0)
			),
			archetypes: safeStringArray(questionDistribution.archetypes),
			conceptual_application_depth: safeStringArray(
				questionDistribution.conceptual_application_depth
			),
			single_vs_multi_concept: safeStringArray(questionDistribution.single_vs_multi_concept),
			direct_vs_indirect_application: safeStringArray(
				questionDistribution.direct_vs_indirect_application
			),
			qualitative_vs_quantitative_reasoning: safeStringArray(
				questionDistribution.qualitative_vs_quantitative_reasoning
			),
			visual_data_usage: safeStringArray(questionDistribution.visual_data_usage),
		},
		question_archetypes: questionArchetypesRaw.map((a) => ({
			name: typeof a.name === 'string' ? a.name : '',
			description: typeof a.description === 'string' ? a.description : '',
			count: parseSafeNumber(a.count, 0),
			percentage: parseSafeNumber(a.percentage, 0),
			representative_question_ids: safeStringArray(a.representative_question_ids),
			what_is_tested: typeof a.what_is_tested === 'string' ? a.what_is_tested : '',
			how_it_is_tested: typeof a.how_it_is_tested === 'string' ? a.how_it_is_tested : '',
			why_it_is_tested_this_way:
				typeof a.why_it_is_tested_this_way === 'string' ? a.why_it_is_tested_this_way : '',
			conceptual_application_depth:
				typeof a.conceptual_application_depth === 'string' ? a.conceptual_application_depth : '',
			reasoning_pattern: typeof a.reasoning_pattern === 'string' ? a.reasoning_pattern : '',
			linguistic_pattern: typeof a.linguistic_pattern === 'string' ? a.linguistic_pattern : '',
			structural_pattern: typeof a.structural_pattern === 'string' ? a.structural_pattern : '',
			surface_form: typeof a.surface_form === 'string' ? a.surface_form : '',
			deep_pattern: typeof a.deep_pattern === 'string' ? a.deep_pattern : '',
			generation_guidance: typeof a.generation_guidance === 'string' ? a.generation_guidance : '',
			anti_imitation_notes:
				typeof a.anti_imitation_notes === 'string' ? a.anti_imitation_notes : '',
		})),
		writing_style: {
			overall_style:
				typeof writingStyle.overall_style === 'string' ? writingStyle.overall_style : '',
			stem_length: typeof writingStyle.stem_length === 'string' ? writingStyle.stem_length : '',
			sentence_structure:
				typeof writingStyle.sentence_structure === 'string' ? writingStyle.sentence_structure : '',
			language_register:
				typeof writingStyle.language_register === 'string' ? writingStyle.language_register : '',
			scenario_usage:
				typeof writingStyle.scenario_usage === 'string' ? writingStyle.scenario_usage : '',
			information_density:
				typeof writingStyle.information_density === 'string'
					? writingStyle.information_density
					: '',
			explicitness: typeof writingStyle.explicitness === 'string' ? writingStyle.explicitness : '',
			technical_language:
				typeof writingStyle.technical_language === 'string' ? writingStyle.technical_language : '',
			numerical_style:
				typeof writingStyle.numerical_style === 'string' ? writingStyle.numerical_style : '',
			recurring_linguistic_patterns: safeStringArray(writingStyle.recurring_linguistic_patterns),
		},
		distractor_patterns: safeStringArray(parsed.distractor_patterns),
		sequencing_and_structure: {
			section_structure:
				typeof sequencingAndStructure.section_structure === 'string'
					? sequencingAndStructure.section_structure
					: '',
			ordering_patterns: safeStringArray(sequencingAndStructure.ordering_patterns),
			progression_patterns: safeStringArray(sequencingAndStructure.progression_patterns),
		},
		cross_question_patterns: safeStringArray(parsed.cross_question_patterns),
		surface_vs_deep_patterns: surfaceVsDeepPatternsRaw.map((p) => ({
			surface_pattern: typeof p.surface_pattern === 'string' ? p.surface_pattern : '',
			deep_pattern: typeof p.deep_pattern === 'string' ? p.deep_pattern : '',
			generation_instruction:
				typeof p.generation_instruction === 'string' ? p.generation_instruction : '',
		})),
		distinctive_generation_rules: safeStringArray(parsed.distinctive_generation_rules),
		anti_imitation_constraints: safeStringArray(parsed.anti_imitation_constraints),
		uncertainties: safeStringArray(parsed.uncertainties),
		rawBlueprintText: rawText,
	};
}
