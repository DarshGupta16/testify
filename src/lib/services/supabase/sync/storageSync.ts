import { supabase } from '$lib/services/supabase/client';
import type { QuestionPreview } from '$lib/types/test';

/**
 * Converts a base64 Data URL to a Blob for multipart/form-data upload.
 */
function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
	const parts = dataUrl.split(',');
	const mimeMatch = parts[0]?.match(/:(.*?);/);
	const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
	const byteString = atob(parts[1] || '');
	const arrayBuffer = new ArrayBuffer(byteString.length);
	const uint8Array = new Uint8Array(arrayBuffer);

	for (let i = 0; i < byteString.length; i++) {
		uint8Array[i] = byteString.charCodeAt(i);
	}

	return {
		blob: new Blob([uint8Array], { type: mimeType }),
		mimeType,
	};
}

/**
 * Uploads question diagrams and embedded figures to Supabase Storage ('assessment-diagrams' bucket).
 * Preserves user instructions: uploads only individual cropped diagram figures, NOT whole-page scans.
 * Replaces local dataUrl with the permanent Supabase public CDN URL.
 */
export async function uploadQuestionDiagrams(
	userId: string,
	testId: string,
	questions: QuestionPreview[]
): Promise<QuestionPreview[]> {
	if (!questions || questions.length === 0 || !userId) {
		return questions;
	}

	let hasUpdates = false;
	const updatedQuestions: QuestionPreview[] = [];

	for (const question of questions) {
		const qClone = { ...question };
		const diagramUrl = qClone.associatedDiagramUrl;

		if (diagramUrl?.startsWith('data:image/')) {
			try {
				const { blob, mimeType } = dataUrlToBlob(diagramUrl);
				const diagramId = qClone.associatedDiagramId || `diag_${qClone.id}`;
				const fileExt = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
				const storagePath = `${userId}/${testId}/${diagramId}.${fileExt}`;

				const { error: uploadError } = await supabase.storage
					.from('assessment-diagrams')
					.upload(storagePath, blob, {
						upsert: true,
						contentType: mimeType,
					});

				if (!uploadError) {
					const { data: publicUrlData } = supabase.storage
						.from('assessment-diagrams')
						.getPublicUrl(storagePath);

					if (publicUrlData?.publicUrl) {
						qClone.associatedDiagramUrl = publicUrlData.publicUrl;
						hasUpdates = true;
					}
				} else {
					console.warn(
						`[StorageSync] Failed uploading diagram for question ${qClone.id}:`,
						uploadError
					);
				}
			} catch (err) {
				console.error(`[StorageSync] Error converting diagram for question ${qClone.id}:`, err);
			}
		}

		updatedQuestions.push(qClone);
	}

	return hasUpdates ? updatedQuestions : questions;
}
