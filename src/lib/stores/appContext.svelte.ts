import { getContext, setContext } from 'svelte';
import type { TestItem, TestUploadPayload } from '$lib/types/test';
import { FilterStore } from './filterStore.svelte';
import { ModalStore } from './modalStore.svelte';
import { TestStore } from './testStore.svelte';
import { ThemeStore } from './themeStore.svelte';
import { ToastStore } from './toastStore.svelte';

const APP_CONTEXT_KEY = Symbol('TESTIFY_APP_CONTEXT');

export class AppStore {
	// Specialized Sub-Stores
	readonly tests = new TestStore();
	readonly filter = new FilterStore();
	readonly modals = new ModalStore();
	readonly theme = new ThemeStore();
	readonly toast = new ToastStore();

	// Composed Derived Reactive Queries
	readonly filteredTests = $derived.by(() => {
		return this.filter.apply(this.tests.tests);
	});

	init() {
		this.theme.init();
		this.tests.init();
	}

	// High-level Orchestration Methods
	async handleAddTest(payload: TestUploadPayload): Promise<TestItem | undefined> {
		try {
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
