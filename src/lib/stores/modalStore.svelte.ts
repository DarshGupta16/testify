import type { TestItem } from '$lib/types/test';

export type MasterPasswordModalMode = 'set' | 'reset';

export class ModalStore {
	isUploadModalOpen = $state<boolean>(false);
	isDetailsModalOpen = $state<boolean>(false);
	isApiKeysModalOpen = $state<boolean>(false);
	isMasterPasswordModalOpen = $state<boolean>(false);
	isSubjectsModalOpen = $state<boolean>(false);
	isEditModalOpen = $state<boolean>(false);
	masterPasswordModalMode = $state<MasterPasswordModalMode>('set');

	selectedTest = $state<TestItem | null>(null);
	editingTest = $state<TestItem | null>(null);

	openEdit(test: TestItem) {
		// Deep clone to ensure edits are completely isolated until explicitly saved
		this.editingTest = JSON.parse(JSON.stringify(test));
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
}
