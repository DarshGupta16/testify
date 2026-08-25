import type { PdfExtractionResult } from '$lib/types/pdf';

export interface AppSettingRecord {
	key: string;
	value: unknown;
	updatedAt: string;
}

export interface TestDocAssetRecord {
	testId: string;
	extractedData: PdfExtractionResult;
}
