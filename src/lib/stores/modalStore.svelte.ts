import type { TestItem } from '$lib/types/test';
import { toCloneable } from '$lib/utils/snapshot.svelte';

export type MasterPasswordModalMode = 'set' | 'reset';

export class ModalStore {
	isUploadModalOpen = $state<boolean>(false);
	isDetailsModalOpen = $state<boolean>(false);
	isApiKeysModalOpen = $state<boolean>(false);
	isMasterPasswordModalOpen = $state<boolean>(false);
	isSubjectsModalOpen = $state<boolean>(false);
	isEditModalOpen = $state<boolean>(false);
	isSimilarPaperOpen = $state<boolean>(false);
	isFoldersModalOpen = $state<boolean>(false);
	isMoveToFolderModalOpen = $state<boolean>(false);
	isAuthModalOpen = $state<boolean>(false);
	isDeleteAccountModalOpen = $state<boolean>(false);
	authModalInitialTab = $state<'signin' | 'signup' | 'forgot'>('signin');
	masterPasswordModalMode = $state<MasterPasswordModalMode>('set');

	selectedTest = $state<TestItem | null>(null);
	editingTest = $state<TestItem | null>(null);
	similarPaperSourceTest = $state<TestItem | null>(null);
	moveTargetTests = $state<TestItem[]>([]);

	readonly anyModalOpen = $derived(
		this.isUploadModalOpen ||
			this.isDetailsModalOpen ||
			this.isApiKeysModalOpen ||
			this.isMasterPasswordModalOpen ||
			this.isSubjectsModalOpen ||
			this.isEditModalOpen ||
			this.isSimilarPaperOpen ||
			this.isFoldersModalOpen ||
			this.isMoveToFolderModalOpen ||
			this.isAuthModalOpen ||
			this.isDeleteAccountModalOpen
	);

	openAuth(tab: 'signin' | 'signup' | 'forgot' = 'signin') {
		this.authModalInitialTab = tab;
		this.isAuthModalOpen = true;
	}

	closeAuth(force = false) {
		if (force || this.isAuthModalOpen) {
			this.isAuthModalOpen = false;
		}
	}

	openDeleteAccount() {
		this.isDeleteAccountModalOpen = true;
	}

	closeDeleteAccount(force = false) {
		if (force || this.isDeleteAccountModalOpen) {
			this.isDeleteAccountModalOpen = false;
		}
	}

	openSimilarPaperModal(test: TestItem) {
		this.similarPaperSourceTest = test;
		this.isSimilarPaperOpen = true;
	}

	closeSimilarPaperModal(force = false) {
		if (force || this.isSimilarPaperOpen) {
			this.isSimilarPaperOpen = false;
			this.similarPaperSourceTest = null;
		}
	}

	openEdit(test: TestItem) {
		// Deep clone to ensure edits are completely isolated until explicitly saved
		try {
			this.editingTest = toCloneable(test);
		} catch {
			this.editingTest = JSON.parse(JSON.stringify(test));
		}
		this.isEditModalOpen = true;
	}

	closeEdit(force = false) {
		if (force || this.isEditModalOpen) {
			this.isEditModalOpen = false;
			this.editingTest = null;
		}
	}

	openSubjects() {
		this.isSubjectsModalOpen = true;
	}

	closeSubjects(force = false) {
		if (force || this.isSubjectsModalOpen) {
			this.isSubjectsModalOpen = false;
		}
	}

	openUpload() {
		this.isUploadModalOpen = true;
	}

	closeUpload(force = false) {
		if (force || this.isUploadModalOpen) {
			this.isUploadModalOpen = false;
		}
	}

	openDetails(test: TestItem) {
		this.selectedTest = test;
		this.isDetailsModalOpen = true;
	}

	closeDetails() {
		this.isDetailsModalOpen = false;
		this.selectedTest = null;
	}

	openApiKeys() {
		this.isApiKeysModalOpen = true;
	}

	closeApiKeys(force = false) {
		if (force || this.isApiKeysModalOpen) {
			this.isApiKeysModalOpen = false;
		}
	}

	openSetMasterPassword() {
		this.masterPasswordModalMode = 'set';
		this.isMasterPasswordModalOpen = true;
	}

	openResetMasterPassword() {
		this.masterPasswordModalMode = 'reset';
		this.isMasterPasswordModalOpen = true;
	}

	closeMasterPassword(force = false) {
		if (force || this.isMasterPasswordModalOpen) {
			this.isMasterPasswordModalOpen = false;
		}
	}

	openFolders() {
		this.isFoldersModalOpen = true;
	}

	closeFolders(force = false) {
		if (force || this.isFoldersModalOpen) {
			this.isFoldersModalOpen = false;
		}
	}

	openMoveToFolder(tests: TestItem | TestItem[]) {
		this.moveTargetTests = Array.isArray(tests) ? tests : [tests];
		this.isMoveToFolderModalOpen = true;
	}

	closeMoveToFolder(force = false) {
		if (force || this.isMoveToFolderModalOpen) {
			this.isMoveToFolderModalOpen = false;
			this.moveTargetTests = [];
		}
	}
}
