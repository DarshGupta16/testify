import { db, fireAndForget, type TestifyDatabase } from '$lib/services/db';
import type { ThemeMode } from '$lib/types/test';

const SETTING_KEY_THEME = 'testify_theme';

export class ThemeStore {
	private database: TestifyDatabase;

	theme = $state<ThemeMode>('light');

	constructor(customDb: TestifyDatabase = db) {
		this.database = customDb;
	}

	async init() {
		if (typeof window === 'undefined') return;

		try {
			// 1. Try loading from Dexie settings
			const savedTheme = await this.database.getSetting<ThemeMode | null>(SETTING_KEY_THEME, null);

			if (savedTheme === 'dark' || savedTheme === 'light') {
				this.setTheme(savedTheme);
			} else {
				// Fallback to legacy localStorage or system preference
				const legacyTheme = localStorage.getItem(SETTING_KEY_THEME) as ThemeMode | null;
				if (legacyTheme === 'dark' || legacyTheme === 'light') {
					this.setTheme(legacyTheme);
				} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
					this.setTheme('dark');
				}
			}
		} catch (err) {
			console.error('[ThemeStore] Failed initializing theme:', err);
		}
	}

	setTheme(mode: ThemeMode) {
		// 1. Synchronous In-Memory update
		this.theme = mode;

		if (typeof window !== 'undefined') {
			if (mode === 'dark') {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
			localStorage.setItem(SETTING_KEY_THEME, mode);

			// 2. Fire-and-forget async Dexie persistence
			fireAndForget(
				this.database.setSetting(SETTING_KEY_THEME, mode),
				`Persisting theme setting (${mode}) to Dexie`
			);
		}
	}

	toggleTheme() {
		this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
	}
}
