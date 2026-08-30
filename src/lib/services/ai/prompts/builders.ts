/**
 * Testify - AI Prompt Builders
 */

import type { AIDiagramAsset, AIGenerationMetadataHints } from '../types';

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
