import { mock } from 'bun:test';

mock.module('$app/environment', () => ({
	browser: false,
	dev: true,
	building: false,
	version: '1.0',
}));

mock.module('$app/navigation', () => ({
	goto: () => Promise.resolve(),
	preloadCode: () => Promise.resolve(),
	preloadData: () => Promise.resolve(),
	beforeNavigate: () => {},
	afterNavigate: () => {},
}));

// Polyfill Svelte 5 runes for headless unit tests in Bun
const globalScope = globalThis as unknown as Record<string, unknown>;

if (!globalScope.$state) {
	globalScope.$state = Object.assign(<T>(initial: T): T => initial, {
		snapshot: <T>(val: T): T => {
			try {
				return structuredClone(val);
			} catch {
				return JSON.parse(JSON.stringify(val));
			}
		},
		raw: <T>(val: T): T => val,
	});
}

if (!globalScope.$derived) {
	globalScope.$derived = Object.assign(<T>(val: T): T => val, {
		by: <T>(fn: () => T): T => fn(),
	});
}
