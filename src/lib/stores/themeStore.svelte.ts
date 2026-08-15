import { db, fireAndForget, type TestifyDatabase } from '$lib/services/db';
import { SETTINGS_KEYS } from '$lib/services/settings';
import type { ThemeMode } from '$lib/types/test';

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
			const savedTheme = await this.database.getSetting<ThemeMode | null>(
				SETTINGS_KEYS.THEME,
				null
			);

			if (savedTheme === 'dark' || savedTheme === 'light') {
				this.setTheme(savedTheme);
			} else {
				// Fallback to legacy localStorage or system preference
				const legacyTheme = localStorage.getItem(SETTINGS_KEYS.THEME) as ThemeMode | null;
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
			localStorage.setItem(SETTINGS_KEYS.THEME, mode);

			// 2. Fire-and-forget async Dexie persistence
			fireAndForget(
				this.database.setSetting(SETTINGS_KEYS.THEME, mode),
				`Persisting theme setting (${mode}) to Dexie`
			);
		}
	}

	toggleTheme() {
		this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
	}
}
