<script lang="ts">
import TestUploadForm from '$lib/components/forms/TestUploadForm.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === 'Escape' && !app.tests.isUploading) {
		app.modals.closeUpload();
	}
}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if app.modals.isUploadModalOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-xs animate-fade-in"
		onclick={(e) => {
			if (e.target === e.currentTarget && !app.tests.isUploading) {
				app.modals.closeUpload();
			}
		}}
		role="presentation"
	>
		<!-- Modal Content -->
		<div
			class="neo-box-lg w-full max-w-3xl bg-surface p-4 sm:p-7 animate-slide-down max-h-[92vh] overflow-y-auto"
			role="dialog"
			aria-modal="true"
			aria-labelledby="upload-modal-title"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b-2 border-border-color pb-3 sm:pb-4 mb-4 sm:mb-6">
				<div class="flex items-center gap-2 sm:gap-2.5">
					<div class="h-3.5 w-3.5 sm:h-4 sm:w-4 bg-accent-contrast"></div>
					<h2 id="upload-modal-title" class="text-base sm:text-xl font-extrabold uppercase tracking-wide">
						Upload & Ingest Test PDF
					</h2>
				</div>
				<button
					type="button"
					onclick={() => app.modals.closeUpload()}
					disabled={app.tests.isUploading}
					class="neo-btn text-xs py-1 px-2.5 disabled:opacity-40"
					aria-label="Close modal"
				>
					✕
				</button>
			</div>

			<!-- Embedded Unified Upload Form -->
			<TestUploadForm
				isModal={true}
				oncancel={() => app.modals.closeUpload()}
				onsuccess={() => app.modals.closeUpload(true)}
			/>
		</div>
	</div>
{/if}
