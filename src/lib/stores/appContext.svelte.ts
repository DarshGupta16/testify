import { getContext, setContext } from 'svelte';
import { db, fireAndForget } from '$lib/services/db';
import type { AIProvider, SecurityMode } from '$lib/types/apiKeys';
import type { TestItem, TestUploadPayload } from '$lib/types/test';
import { ApiKeyStore } from './apiKeyStore.svelte';
import { FilterStore } from './filterStore.svelte';
import { ModalStore } from './modalStore.svelte';
import { SecurityStore } from './securityStore.svelte';
import { TestStore } from './testStore.svelte';
import { ThemeStore } from './themeStore.svelte';
import { ToastStore } from './toastStore.svelte';

const APP_CONTEXT_KEY = Symbol('TESTIFY_APP_CONTEXT');
const SETTING_KEY_SCALE = 'testify_extraction_scale';

export class AppStore {
	// Specialized Sub-Stores
	readonly tests = new TestStore();
	readonly filter = new FilterStore();
	readonly modals = new ModalStore();
	readonly theme = new ThemeStore();
	readonly toast = new ToastStore();
	readonly security = new SecurityStore();
	readonly apiKeys = new ApiKeyStore();

	// Global extraction scale preference (1.0x, 1.25x, 1.5x, 2.0x)
	selectedScale = $state<number>(1.25);

	// Composed Derived Reactive Queries
	readonly filteredTests = $derived.by(() => {
		return this.filter.apply(this.tests.tests);
	});

	async init() {
		this.theme.init();
		await this.tests.init();

		this.security.setOnSessionExpire(() => {
			this.apiKeys.purgeMemory();
		});

		await this.security.init();
		await this.apiKeys.init(this.security.securityMode);

		// Load saved extraction scale from Dexie
		try {
			const savedScale = await db.getSetting<number>(SETTING_KEY_SCALE, 1.25);
			if (typeof savedScale === 'number' && savedScale > 0) {
				this.selectedScale = savedScale;
			}
		} catch (err) {
			console.error('[AppStore] Failed loading scale preference:', err);
		}
	}

	setScale(scale: number) {
		this.selectedScale = scale;
		fireAndForget(
			db.setSetting(SETTING_KEY_SCALE, scale),
			`Persisting scale setting (${scale}) to Dexie`
		);
	}

	// High-level Security & API Key Orchestration
	async handleUnlock(password: string): Promise<boolean> {
		return await this.security.unlock(password, async (pwd) => {
			await this.apiKeys.decryptAllKeys(pwd);
		});
	}

	handleLock(reason?: string): void {
		this.security.lock(reason, () => {
			this.apiKeys.purgeMemory();
		});
	}

	async handleSetMasterPassword(password: string): Promise<void> {
		await this.security.setMasterPassword(password, async (pwd) => {
			await this.apiKeys.encryptAllKeys(pwd);
		});
	}

	async handleResetMasterPassword(): Promise<void> {
		await this.security.resetMasterPassword(async () => {
			await this.apiKeys.clearAllKeys();
		});
	}

	async handleSwitchSecurityMode(targetMode: SecurityMode, password?: string): Promise<void> {
		await this.security.switchSecurityMode(
			targetMode,
			this.apiKeys.hasAnyConfigured,
			password,
			async (mode, pwd) => {
				if (mode === 'strict' && pwd) {
					await this.apiKeys.encryptAllKeys(pwd);
				} else if (mode === 'lax') {
					await this.apiKeys.makeAllKeysPlaintext();
				}
			}
		);
	}

	handleSaveKey(provider: AIProvider, key: string, password?: string): void {
		const pwd = password || this.security.activeMasterPassword;
		this.apiKeys.setKey(provider, key, this.security.securityMode, pwd);
	}

	// High-level Test Orchestration Methods
	async handleAddTest(payload: TestUploadPayload): Promise<TestItem | undefined> {
		try {
			if (!payload.scale) {
				payload.scale = this.selectedScale;
			}
			const newTest = await this.tests.createTest(payload);
			this.toast.show(`Test "${newTest.title}" created successfully!`, 'success');
			this.modals.closeUpload(true);
			return newTest;
		} catch (error) {
			this.toast.show('Failed to process test PDF.', 'error');
			console.error(error);
		}
	}

	handleDeleteTest(id: string) {
		const deleted = this.tests.deleteTest(id);
		if (this.modals.selectedTest?.id === id) {
			this.modals.closeDetails();
		}
		if (deleted) {
			this.toast.show(`Test "${deleted.title}" deleted.`, 'info');
		}
	}

	handleClearAllTests() {
		this.tests.clearAll();
		this.modals.closeDetails();
		this.toast.show('All tests cleared.', 'warning');
	}

	handleLoadSamples() {
		this.tests.loadSamples();
		this.toast.show('Loaded sample practice tests.', 'info');
	}
}

/**
 * Provide AppStore via SvelteKit Context (Client-isolated)
 */
export function setAppContext(store: AppStore) {
	return setContext(APP_CONTEXT_KEY, store);
}

/**
 * Retrieve AppStore from SvelteKit Context
 */
export function getAppContext(): AppStore {
	const store = getContext<AppStore>(APP_CONTEXT_KEY);
	if (!store) {
		throw new Error(
			'AppStore not found in Svelte context. Ensure setAppContext is called in +layout.svelte.'
		);
	}
	return store;
}
