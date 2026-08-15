import { getContext, setContext } from 'svelte';
import { db, fireAndForget } from '$lib/services/db';
import { SETTINGS_KEYS } from '$lib/services/settings';
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

export class AppStore {
	// Specialized Domain Sub-Stores
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
		// 1. Initialize persistent UI preferences & local exam collections
		await this.theme.init();
		await this.tests.init();

		// 2. Wire security session expiry hook to key purge
		this.security.setOnSessionExpire(() => {
			this.apiKeys.purgeMemory();
		});

		// 3. Initialize security authentication state and API key records
		await this.security.init();
		await this.apiKeys.init(this.security.securityMode);

		// 4. Load saved extraction scale from Dexie
		try {
			const savedScale = await db.getSetting<number>(SETTINGS_KEYS.EXTRACTION_SCALE, 1.25);
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
			db.setSetting(SETTINGS_KEYS.EXTRACTION_SCALE, scale),
			`Persisting scale setting (${scale}) to Dexie`
		);
	}

	// --- Linear Security & Authentication Orchestration ---

	async handleUnlock(password: string): Promise<boolean> {
		// 1. Atomically decrypt keys with provided password (throws if incorrect)
		await this.apiKeys.decryptAllKeys(password);

		// 2. Activate unlocked session in security store
		this.security.unlock(password);
		return true;
	}

	handleLock(reason?: string): void {
		this.security.lock(reason);
		this.apiKeys.purgeMemory();
	}

	async handleSetMasterPassword(password: string): Promise<void> {
		// 1. Encrypt existing in-memory keys with new master password
		await this.apiKeys.encryptAllKeys(password);

		// 2. Activate master password and switch to Strict mode
		await this.security.setMasterPassword(password);
	}

	async handleResetMasterPassword(): Promise<void> {
		// 1. Purge all encrypted key records
		await this.apiKeys.clearAllKeys();

		// 2. Reset master password settings and return to Lax mode
		await this.security.resetMasterPassword();
	}

	async handleSwitchSecurityMode(targetMode: SecurityMode, password?: string): Promise<void> {
		if (this.security.securityMode === targetMode) return;

		// 1. Migrate stored credentials format
		if (targetMode === 'strict') {
			if (!password) {
				throw new Error('Master password is required to switch to Strict mode.');
			}
			await this.apiKeys.encryptAllKeys(password);
		} else {
			await this.apiKeys.makeAllKeysPlaintext();
		}

		// 2. Commit security mode state change
		await this.security.switchSecurityMode(targetMode, password);
	}

	handleSaveKey(provider: AIProvider, key: string, password?: string): void {
		const pwd = password || this.security.getActiveMasterPassword();
		this.apiKeys.setKey(provider, key, this.security.securityMode, pwd);
	}

	// --- High-Level Test Orchestration Methods ---

	async handleAddTest(payload: TestUploadPayload): Promise<TestItem | undefined> {
		try {
			if (!payload.scale) {
				payload.scale = this.selectedScale;
			}
			const apiKey = payload.aiProvider ? this.apiKeys.getKey(payload.aiProvider) : undefined;
			const newTest = await this.tests.createTest(payload, apiKey);
			this.toast.show(`Test "${newTest.title}" created successfully!`, 'success');
			this.modals.closeUpload(true);
			return newTest;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Failed to process test PDF.';
			this.toast.show(errorMsg, 'error', 8000);
			console.error('[AppStore] Upload error:', error);
			throw error;
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
