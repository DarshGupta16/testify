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
	CONFIRM_FOLDER_DELETE: 'testify_confirm_folder_delete',
	// AI & Generation Defaults
	DEFAULT_AI_PROVIDER: 'testify_default_ai_provider',
	DEFAULT_AI_MODEL: 'testify_default_ai_model',
	DEFAULT_DURATION_MINUTES: 'testify_default_duration_minutes',
	DEFAULT_IS_UNTIMED: 'testify_default_is_untimed',
	AUTO_TITLE_DEFAULT: 'testify_auto_title_default',
	GLOBAL_CUSTOM_INSTRUCTIONS: 'testify_global_custom_instructions',
	// PDF & Engine
	AUTO_PURGE_PAGE_CANVASES: 'testify_auto_purge_page_canvases',
	KATEX_FONT_SIZE: 'testify_katex_font_size',
	// Exam Taking & Evaluation
	EXAM_VIEW_MODE: 'testify_exam_view_mode',
	EVALUATION_MODE: 'testify_evaluation_mode',
	DEFAULT_POSITIVE_MARKS: 'testify_default_positive_marks',
	DEFAULT_NEGATIVE_MARKS: 'testify_default_negative_marks',
	AUTO_SAVE_INTERVAL: 'testify_auto_save_interval',
	// Appearance & Workflow
	AUDIO_FEEDBACK: 'testify_audio_feedback',
} as const;

export type SettingKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

export type ExamViewMode = 'focus' | 'paper';
export type EvaluationMode = 'exam' | 'study';
export type KatexFontSize = 'standard' | 'large' | 'extra-large';
