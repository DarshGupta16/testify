import { describe, expect, it } from 'bun:test';
import { AppStore } from '$lib/stores/appContext.svelte';
import { SettingsStore } from '$lib/stores/settingsStore.svelte';

describe('SettingsStore & Configuration Architecture', () => {
	it('initializes with production-grade default settings', () => {
		const settings = new SettingsStore();

		// AI Preferences
		expect(settings.defaultAiProvider).toBe('google');
		expect(settings.defaultAiModel).toBe('gemini-3.7-flash');

		// PDF & Engine Defaults
		expect(settings.defaultDurationMinutes).toBe(60);
		expect(settings.defaultIsUntimed).toBe(false);
		expect(settings.autoTitleDefault).toBe(true);
		expect(settings.globalCustomInstructions).toBe('');
		expect(settings.autoPurgePageCanvases).toBe(false);

		// Appearance & Math
		expect(settings.katexFontSize).toBe('standard');

		// Exam Taking & Evaluation
		expect(settings.examViewMode).toBe('focus');
		expect(settings.evaluationMode).toBe('exam');
		expect(settings.defaultPositiveMarks).toBe(4);
		expect(settings.defaultNegativeMarks).toBe(1);
		expect(settings.autoSaveInterval).toBe(5);
		expect(settings.audioFeedback).toBe(true);
	});

	it('updates settings reactively via domain methods', async () => {
		const settings = new SettingsStore();

		await settings.setDefaultAiProvider('openai');
		expect(settings.defaultAiProvider).toBe('openai');

		await settings.setDefaultAiModel('gpt-4o-mini');
		expect(settings.defaultAiModel).toBe('gpt-4o-mini');

		await settings.setDefaultDurationMinutes(90);
		expect(settings.defaultDurationMinutes).toBe(90);

		await settings.setDefaultIsUntimed(true);
		expect(settings.defaultIsUntimed).toBe(true);

		await settings.setAutoTitleDefault(false);
		expect(settings.autoTitleDefault).toBe(false);

		await settings.setGlobalCustomInstructions('Focus strictly on multiple choice options.');
		expect(settings.globalCustomInstructions).toBe('Focus strictly on multiple choice options.');

		await settings.setAutoPurgePageCanvases(true);
		expect(settings.autoPurgePageCanvases).toBe(true);

		await settings.setKatexFontSize('large');
		expect(settings.katexFontSize).toBe('large');

		await settings.setExamViewMode('paper');
		expect(settings.examViewMode).toBe('paper');

		await settings.setEvaluationMode('study');
		expect(settings.evaluationMode).toBe('study');

		await settings.setDefaultMarks(3, 0);
		expect(settings.defaultPositiveMarks).toBe(3);
		expect(settings.defaultNegativeMarks).toBe(0);

		await settings.setAutoSaveInterval(60);
		expect(settings.autoSaveInterval).toBe(60);

		await settings.setAudioFeedback(false);
		expect(settings.audioFeedback).toBe(false);
	});

	it('resets all preferences to defaults cleanly with resetToDefaults', async () => {
		const settings = new SettingsStore();

		// Mutate several values
		await settings.setDefaultAiProvider('anthropic');
		await settings.setExamViewMode('paper');
		await settings.setDefaultMarks(5, 2);
		await settings.setAudioFeedback(false);

		expect(settings.defaultAiProvider).toBe('anthropic');
		expect(settings.examViewMode).toBe('paper');
		expect(settings.defaultPositiveMarks).toBe(5);
		expect(settings.audioFeedback).toBe(false);

		// Reset
		await settings.resetToDefaults();

		expect(settings.defaultAiProvider).toBe('google');
		expect(settings.examViewMode).toBe('focus');
		expect(settings.defaultPositiveMarks).toBe(4);
		expect(settings.defaultNegativeMarks).toBe(1);
		expect(settings.audioFeedback).toBe(true);
	});

	it('integrates seamlessly with AppContext singleton instance', () => {
		const app = new AppStore();

		expect(app.settings).toBeDefined();
		expect(app.settings.defaultDurationMinutes).toBe(60);
		expect(app.settings.examViewMode).toBe('focus');
		expect(app.settings.evaluationMode).toBe('exam');
	});
});
