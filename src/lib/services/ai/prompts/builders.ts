/**
 * Testify - AI Prompt Builders
 */

import type {
	AIDiagramAsset,
	AIGenerationMetadataHints,
	PaperBlueprintPayload,
	SimilarPaperGenerationPayload,
} from '../types';

/**
 * Builds the dynamic user prompt tailored to the specific upload metadata and diagram inventory.
 */
export function buildUserPrompt(
	metadata?: AIGenerationMetadataHints,
	diagrams?: AIDiagramAsset[],
	hasSeparateAnswerKey = false
): string {
	const sections: string[] = [];

	sections.push('Please digitize and structure all questions from the attached document pages.');

	if (metadata?.titleHint && !metadata.autoTitle) {
		sections.push(`- Assessment Title: Use "${metadata.titleHint}".`);
	} else {
		sections.push('- Assessment Title: Auto-detect the exact title from the document header.');
	}

	if (metadata?.isUntimed) {
		sections.push('- Duration: The user has marked this test as Untimed.');
	} else if (metadata?.defaultDurationMinutes && !metadata.autoDuration) {
		sections.push(
			`- Duration: Set estimated duration to ${metadata.defaultDurationMinutes} minutes.`
		);
	} else {
		sections.push(
			'- Duration: Estimate a reasonable exam duration in minutes based on question complexity and count.'
		);
	}

	if (hasSeparateAnswerKey) {
		sections.push(
			'- Answer Key: The last attached page(s) represent a separate Answer Key / Solution Matrix. Match each question with its exact answer.'
		);
	} else {
		sections.push(
			'- Answer Key: No separate answer key was provided. Check if the PDF has an embedded answer key table/grid (often on the final page or footer). If present, use it. Otherwise, solve each question directly.'
		);
	}

	if (diagrams && diagrams.length > 0) {
		sections.push('\n### Extracted Diagram Catalog:');
		sections.push(
			'The following isolated diagram crops and visual figures have been extracted from the document:'
		);
		for (const d of diagrams) {
			sections.push(`- Diagram ID: "${d.id}" (Appears on Page ${d.pageNumber})`);
		}
		sections.push(
			'\n### STRICT DIAGRAM LINKING RULES:\n' +
				'1. Only set "associatedDiagramId" to a Diagram ID if that specific isolated figure is strictly relevant and provides essential context as an integral part of that exact question.\n' +
				'2. NEVER attach answer key images, solution sheets, answer grids, or grading tables to any question.\n' +
				'3. NEVER attach entire page images, full document page scans, or multi-question crops to any question.\n' +
				'4. NEVER attach the same image to all or multiple unrelated questions.\n' +
				'5. For all questions that are purely text/formula-based or do not have their own dedicated diagram figure, set "associatedDiagramId": null.'
		);
	} else {
		sections.push(
			'\n### Diagram Linking:\n' +
				'No isolated diagram figures are present in the catalog. Set "associatedDiagramId": null for all questions. Do not attach full page scans or answer keys.'
		);
	}

	sections.push(
		'\nReturn the complete assessment as a valid JSON object strictly complying with the schema.'
	);

	return sections.join('\n');
}

/**
 * Builds the user prompt for Phase 1 Blueprint Extraction containing the structured source paper questions and catalog.
 */
export function buildBlueprintUserPrompt(payload: PaperBlueprintPayload): string {
	const sections: string[] = [];

	sections.push('# Source Paper for Blueprint Analysis');
	if (payload.title) {
		sections.push(`**Title**: ${payload.title}`);
	}
	if (payload.instructions) {
		sections.push(`**Instructions**: ${payload.instructions}`);
	}

	sections.push('\n## Structured Questions Data:');
	sections.push(JSON.stringify(payload.questions, null, 2));

	if (payload.diagrams && payload.diagrams.length > 0) {
		sections.push('\n## Associated Diagram Catalog:');
		for (const d of payload.diagrams) {
			sections.push(`- Diagram ID: "${d.id}" (Page ${d.pageNumber})`);
		}
	}

	sections.push(
		'\nAnalyze the provided question paper across all analytical dimensions and return ONLY the complete, structured Paper Blueprint JSON.'
	);

	return sections.join('\n');
}

/**
 * Builds the user prompt for Phase 2 Similar Paper Generation containing the blueprint, user instructions, and target constraints.
 */
export function buildSimilarPaperUserPrompt(payload: SimilarPaperGenerationPayload): string {
	const sections: string[] = [];

	sections.push('# Paper Generation Task: Similar Paper');
	sections.push(
		'Generate a completely new, high-fidelity question paper based on the attached Paper Blueprint.'
	);

	sections.push('\n## Paper Blueprint Specification (from Phase 1 Analysis):');
	sections.push(JSON.stringify(payload.blueprint, null, 2));

	if (payload.userInstructions && payload.userInstructions.trim().length > 0) {
		sections.push('\n## User Instructions & Custom Constraints:');
		sections.push(payload.userInstructions.trim());
	}

	if (payload.questionCount && payload.questionCount > 0) {
		sections.push(
			`\n## Target Question Count:\nGenerate exactly ${payload.questionCount} questions matching the blueprint archetype distribution.`
		);
	} else if (payload.metadata?.questionCountHint && payload.metadata.questionCountHint > 0) {
		sections.push(
			`\n## Target Question Count:\nGenerate exactly ${payload.metadata.questionCountHint} questions matching the blueprint archetype distribution.`
		);
	}

	if (payload.metadata?.titleHint && !payload.metadata.autoTitle) {
		sections.push(`\n## Assessment Title Hint:\nUse "${payload.metadata.titleHint}".`);
	}

	if (payload.metadata?.isUntimed) {
		sections.push('\n## Duration:\nThe user has marked this generated assessment as Untimed.');
	} else if (payload.metadata?.defaultDurationMinutes && !payload.metadata.autoDuration) {
		sections.push(
			`\n## Duration:\nSet duration to ${payload.metadata.defaultDurationMinutes} minutes.`
		);
	}

	sections.push(
		'\nGenerate the complete similar assessment now. Return the assessment matching the required schema.'
	);

	return sections.join('\n');
}

