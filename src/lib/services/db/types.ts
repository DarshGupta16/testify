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

export type OfflineOpTable =
	| 'tests'
	| 'folders'
	| 'subjects'
	| 'attempts'
	| 'settings'
	| 'synced_api_keys';

export type OfflineOpAction = 'create' | 'update' | 'delete';

export interface OfflineOp {
	id?: number;
	table: OfflineOpTable;
	action: OfflineOpAction;
	recordId: string;
	data: unknown;
	timestamp: number;
}
