import { db, fireAndForget } from '$lib/services/db';
import {
	type EvaluationMode,
	type ExamViewMode,
	type KatexFontSize,
	SETTINGS_KEYS,
} from '$lib/services/settings';
import { supabase, trySupabaseOrQueue } from '$lib/services/supabase';
import type { AIProvider } from '$lib/types/apiKeys';

export class SettingsStore {
	// AI & Generation Defaults
	defaultAiProvider = $state<AIProvider>('google');
	defaultAiModel = $state<string>('gemini-3.7-flash');
	defaultDurationMinutes = $state<number>(60);
	defaultIsUntimed = $state<boolean>(false);
	autoTitleDefault = $state<boolean>(true);
	globalCustomInstructions = $state<string>('');

	// PDF & Engine Defaults
	autoPurgePageCanvases = $state<boolean>(false);
	katexFontSize = $state<KatexFontSize>('standard');

	// Exam Taking & Evaluation
	examViewMode = $state<ExamViewMode>('focus');
	evaluationMode = $state<EvaluationMode>('exam');
	defaultPositiveMarks = $state<number>(4);
	defaultNegativeMarks = $state<number>(1);
	autoSaveInterval = $state<number>(5);

	// Appearance & Workflow
	audioFeedback = $state<boolean>(true);

	isLoaded = $state<boolean>(false);

	/**
	 * Initialize settings from local Dexie IndexedDB cache.
	 */
	async init(): Promise<void> {
		try {
			const [
				provider,
				model,
				duration,
				isUntimed,
				autoTitle,
				customInstructions,
				autoPurge,
				katexSize,
				examView,
				evalMode,
				posMarks,
				negMarks,
				autoSave,
				audio,
			] = await Promise.all([
				db.getSetting<AIProvider>(SETTINGS_KEYS.DEFAULT_AI_PROVIDER, this.defaultAiProvider),
				db.getSetting<string>(SETTINGS_KEYS.DEFAULT_AI_MODEL, this.defaultAiModel),
				db.getSetting<number>(SETTINGS_KEYS.DEFAULT_DURATION_MINUTES, this.defaultDurationMinutes),
				db.getSetting<boolean>(SETTINGS_KEYS.DEFAULT_IS_UNTIMED, this.defaultIsUntimed),
				db.getSetting<boolean>(SETTINGS_KEYS.AUTO_TITLE_DEFAULT, this.autoTitleDefault),
				db.getSetting<string>(
					SETTINGS_KEYS.GLOBAL_CUSTOM_INSTRUCTIONS,
					this.globalCustomInstructions
				),
				db.getSetting<boolean>(SETTINGS_KEYS.AUTO_PURGE_PAGE_CANVASES, this.autoPurgePageCanvases),
				db.getSetting<KatexFontSize>(SETTINGS_KEYS.KATEX_FONT_SIZE, this.katexFontSize),
				db.getSetting<ExamViewMode>(SETTINGS_KEYS.EXAM_VIEW_MODE, this.examViewMode),
				db.getSetting<EvaluationMode>(SETTINGS_KEYS.EVALUATION_MODE, this.evaluationMode),
				db.getSetting<number>(SETTINGS_KEYS.DEFAULT_POSITIVE_MARKS, this.defaultPositiveMarks),
				db.getSetting<number>(SETTINGS_KEYS.DEFAULT_NEGATIVE_MARKS, this.defaultNegativeMarks),
				db.getSetting<number>(SETTINGS_KEYS.AUTO_SAVE_INTERVAL, this.autoSaveInterval),
				db.getSetting<boolean>(SETTINGS_KEYS.AUDIO_FEEDBACK, this.audioFeedback),
			]);

			this.defaultAiProvider = provider;
			this.defaultAiModel = model;
			this.defaultDurationMinutes = duration;
			this.defaultIsUntimed = isUntimed;
			this.autoTitleDefault = autoTitle;
			this.globalCustomInstructions = customInstructions;
			this.autoPurgePageCanvases = autoPurge;
			this.katexFontSize = katexSize;
			this.examViewMode = examView;
			this.evaluationMode = evalMode;
			this.defaultPositiveMarks = posMarks;
			this.defaultNegativeMarks = negMarks;
			this.autoSaveInterval = autoSave;
			this.audioFeedback = audio;
		} catch (err) {
			console.error('[SettingsStore] Error reading settings from Dexie:', err);
		} finally {
			this.isLoaded = true;
		}
	}

	private persistSetting<T>(key: string, value: T, description: string) {
		fireAndForget(db.setSetting(key, value), `Persisting ${description} (${key}) to Dexie`);

		// Async cloud sync for authenticated users
		fireAndForget(
			trySupabaseOrQueue(
				async () => {
					const now = new Date().toISOString();
					return supabase.from('settings').upsert({
						key,
						value: value as unknown as import('$lib/services/supabase/types').Json,
						updated_at: now,
					});
				},
				{
					table: 'settings',
					action: 'update',
					recordId: key,
					data: { key, value },
				}
			),
			`Syncing setting ${key} to Supabase`
		);
	}

	setDefaultAiProvider(provider: AIProvider): void {
		this.defaultAiProvider = provider;
		this.persistSetting(SETTINGS_KEYS.DEFAULT_AI_PROVIDER, provider, 'default AI provider');
	}

	setDefaultAiModel(model: string): void {
		this.defaultAiModel = model;
		this.persistSetting(SETTINGS_KEYS.DEFAULT_AI_MODEL, model, 'default AI model');
	}

	setDefaultDurationMinutes(minutes: number): void {
		this.defaultDurationMinutes = minutes;
		this.persistSetting(SETTINGS_KEYS.DEFAULT_DURATION_MINUTES, minutes, 'default duration');
	}

	setDefaultIsUntimed(isUntimed: boolean): void {
		this.defaultIsUntimed = isUntimed;
		this.persistSetting(SETTINGS_KEYS.DEFAULT_IS_UNTIMED, isUntimed, 'default untimed flag');
	}

	setAutoTitleDefault(enabled: boolean): void {
		this.autoTitleDefault = enabled;
		this.persistSetting(SETTINGS_KEYS.AUTO_TITLE_DEFAULT, enabled, 'auto title default');
	}

	setGlobalCustomInstructions(instructions: string): void {
		this.globalCustomInstructions = instructions;
		this.persistSetting(
			SETTINGS_KEYS.GLOBAL_CUSTOM_INSTRUCTIONS,
			instructions,
			'global custom instructions'
		);
	}

	setAutoPurgePageCanvases(enabled: boolean): void {
		this.autoPurgePageCanvases = enabled;
		this.persistSetting(
			SETTINGS_KEYS.AUTO_PURGE_PAGE_CANVASES,
			enabled,
			'auto purge page canvases'
		);
	}

	setKatexFontSize(size: KatexFontSize): void {
		this.katexFontSize = size;
		this.persistSetting(SETTINGS_KEYS.KATEX_FONT_SIZE, size, 'KaTeX font size');
	}

	setExamViewMode(mode: ExamViewMode): void {
		this.examViewMode = mode;
		this.persistSetting(SETTINGS_KEYS.EXAM_VIEW_MODE, mode, 'exam view mode');
	}

	setEvaluationMode(mode: EvaluationMode): void {
		this.evaluationMode = mode;
		this.persistSetting(SETTINGS_KEYS.EVALUATION_MODE, mode, 'evaluation mode');
	}

	setDefaultPositiveMarks(marks: number): void {
		this.defaultPositiveMarks = marks;
		this.persistSetting(SETTINGS_KEYS.DEFAULT_POSITIVE_MARKS, marks, 'default positive marks');
	}

	setDefaultNegativeMarks(marks: number): void {
		this.defaultNegativeMarks = marks;
		this.persistSetting(SETTINGS_KEYS.DEFAULT_NEGATIVE_MARKS, marks, 'default negative marks');
	}

	setAutoSaveInterval(seconds: number): void {
		this.autoSaveInterval = seconds;
		this.persistSetting(SETTINGS_KEYS.AUTO_SAVE_INTERVAL, seconds, 'auto save interval');
	}

	setAudioFeedback(enabled: boolean): void {
		this.audioFeedback = enabled;
		this.persistSetting(SETTINGS_KEYS.AUDIO_FEEDBACK, enabled, 'audio feedback');
	}

	setDefaultMarks(positive: number, negative: number): void {
		this.setDefaultPositiveMarks(positive);
		this.setDefaultNegativeMarks(negative);
	}

	async resetToDefaults(): Promise<void> {
		this.setDefaultAiProvider('google');
		this.setDefaultAiModel('gemini-3.7-flash');
		this.setDefaultDurationMinutes(60);
		this.setDefaultIsUntimed(false);
		this.setAutoTitleDefault(true);
		this.setGlobalCustomInstructions('');
		this.setAutoPurgePageCanvases(false);
		this.setKatexFontSize('standard');
		this.setExamViewMode('focus');
		this.setEvaluationMode('exam');
		this.setDefaultPositiveMarks(4);
		this.setDefaultNegativeMarks(1);
		this.setAutoSaveInterval(5);
		this.setAudioFeedback(true);
	}
}
