import type { TestItem } from '$lib/types/test';

export class ModalStore {
	isUploadModalOpen = $state<boolean>(false);
	isDetailsModalOpen = $state<boolean>(false);
	selectedTest = $state<TestItem | null>(null);

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
}
