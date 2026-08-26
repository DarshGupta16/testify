/**
 * Testify - Application Settings Constants & Persistence Schema
 */

export const SETTINGS_KEYS = {
	THEME: 'testify_theme',
	SECURITY_MODE: 'testify_security_mode',
	HAS_MASTER_PASSWORD: 'testify_has_master_password',
	EXTRACTION_SCALE: 'testify_extraction_scale',
	QUEUE_MODE: 'testify_queue_mode',
	QUEUE_CONCURRENCY: 'testify_queue_concurrency',
} as const;

export type SettingKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];
