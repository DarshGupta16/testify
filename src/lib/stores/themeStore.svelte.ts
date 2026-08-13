import type { ThemeMode } from '$lib/types/test';

const STORAGE_KEY_THEME = 'testify_theme';

export class ThemeStore {
	theme = $state<ThemeMode>('light');

	init() {
		if (typeof window === 'undefined') return;

		const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) as ThemeMode | null;
		if (savedTheme === 'dark' || savedTheme === 'light') {
			this.setTheme(savedTheme);
		} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
			this.setTheme('dark');
		}
	}

	setTheme(mode: ThemeMode) {
		this.theme = mode;
		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_KEY_THEME, mode);
			if (mode === 'dark') {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		}
	}

	toggleTheme() {
		this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
	}
}
