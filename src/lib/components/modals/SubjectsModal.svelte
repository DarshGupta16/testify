<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

let newSubjectName = $state('');
let addError = $state('');

// Inline editing state
let editingId = $state<string | null>(null);
let editingName = $state('');
let editError = $state('');

// Deletion confirmation state
let confirmingDeleteId = $state<string | null>(null);

function handleClose() {
	app.modals.closeSubjects();
	newSubjectName = '';
	addError = '';
	editingId = null;
	editingName = '';
	editError = '';
	confirmingDeleteId = null;
}

function handleAddSubject(e?: Event) {
	e?.preventDefault();
	addError = '';
	const trimmed = newSubjectName.trim();
	if (!trimmed) {
		addError = 'Please enter a subject name.';
		return;
	}

	try {
		const created = app.subjects.addSubject(trimmed);
		app.toast.show(`Subject "${created.name}" created!`, 'success');
		newSubjectName = '';
	} catch (err) {
		addError = err instanceof Error ? err.message : 'Failed to add subject.';
	}
}

function startEditing(id: string, currentName: string) {
	editingId = id;
	editingName = currentName;
	editError = '';
	confirmingDeleteId = null;
}

function cancelEditing() {
	editingId = null;
	editingName = '';
	editError = '';
}

function saveEditing(id: string) {
	editError = '';
	const trimmed = editingName.trim();
	if (!trimmed) {
		editError = 'Name cannot be empty.';
		return;
	}

	try {
		const updated = app.subjects.updateSubject(id, trimmed);
		app.toast.show(`Subject renamed to "${updated.name}".`, 'success');
		editingId = null;
		editingName = '';
	} catch (err) {
		editError = err instanceof Error ? err.message : 'Failed to update subject.';
	}
}

function handleDeleteClick(id: string) {
	if (confirmingDeleteId !== id) {
		confirmingDeleteId = id;
		editingId = null;
		return;
	}

	app.handleDeleteSubject(id);
	confirmingDeleteId = null;
}

function getTestCountForSubject(subjectId: string): number {
	return app.tests.tests.filter((t) => t.subjectId === subjectId).length;
}

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === 'Escape' && app.modals.isSubjectsModalOpen) {
		if (editingId) {
			cancelEditing();
		} else if (confirmingDeleteId) {
			confirmingDeleteId = null;
		} else {
			handleClose();
		}
	}
}

function focusInput(node: HTMLElement) {
	node.focus();
}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if app.modals.isSubjectsModalOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fade-in"
		onclick={(e) => {
			if (e.target === e.currentTarget) handleClose();
		}}
		role="presentation"
	>
		<!-- Modal Box -->
		<div
			class="neo-box-lg w-full max-w-xl bg-surface p-6 sm:p-8 animate-slide-down max-h-[90vh] overflow-y-auto space-y-6"
			role="dialog"
			aria-modal="true"
			aria-labelledby="subjects-modal-title"
		>
			<!-- Header -->
			<div class="flex items-start justify-between border-b-2 border-border-color pb-4">
				<div>
					<div class="flex items-center gap-2 mb-1">
						<span class="neo-badge bg-accent-contrast text-accent-contrast-text text-[10px] font-mono">
							CONFIGURATION
						</span>
					</div>
					<h2 id="subjects-modal-title" class="text-xl sm:text-2xl font-black uppercase tracking-tight text-text-primary">
						Configure Subjects
					</h2>
					<p class="font-mono text-xs text-text-secondary mt-1">
						Add, rename, or remove subject categories. Renaming instantly updates all linked tests.
					</p>
				</div>

				<button
					type="button"
					onclick={handleClose}
					class="neo-btn text-xs py-1 px-2.5"
					aria-label="Close modal"
				>
					✕
				</button>
			</div>

			<!-- Add New Subject Form -->
			<div class="neo-box p-4 bg-muted/40 space-y-3">
				<label for="new-subject-input" class="block font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
					Add New Subject
				</label>
				<form onsubmit={handleAddSubject} class="flex items-center gap-2">
					<input
						id="new-subject-input"
						type="text"
						bind:value={newSubjectName}
						placeholder="e.g. Organic Chemistry, Macroeconomics..."
						class="neo-input flex-1 text-sm bg-surface"
					/>
					<button
						type="submit"
						class="neo-btn neo-btn-primary text-xs py-2 px-4 shrink-0 font-bold"
					>
						+ Add
					</button>
				</form>
				{#if addError}
					<p class="font-mono text-xs text-rose-500 font-bold">{addError}</p>
				{/if}
			</div>

			<!-- Subjects List -->
			<div class="space-y-3">
				<div class="flex items-center justify-between font-mono text-xs font-bold uppercase tracking-wider text-text-muted">
					<span>Configured Subjects ({app.subjects.subjects.length})</span>
					<span>Linked Tests</span>
				</div>

				<div class="space-y-2 max-h-72 overflow-y-auto pr-1">
					{#each app.subjects.subjects as sub (sub.id)}
						{@const testCount = getTestCountForSubject(sub.id)}
						<div class="neo-box p-3 sm:p-3.5 bg-surface flex items-center justify-between gap-3 group transition-all">
							{#if editingId === sub.id}
								<!-- Inline Edit Form -->
								<div class="flex-1 space-y-1.5">
									<div class="flex items-center gap-2">
										<input
											type="text"
											bind:value={editingName}
											use:focusInput
											onkeydown={(e) => {
												if (e.key === 'Enter') saveEditing(sub.id);
												if (e.key === 'Escape') cancelEditing();
											}}
											class="neo-input text-xs font-bold flex-1 py-1.5 px-2 bg-surface"
											placeholder="Subject name"
										/>
										<button
											type="button"
											onclick={() => saveEditing(sub.id)}
											class="neo-btn neo-btn-primary text-xs py-1 px-3"
										>
											Save
										</button>
										<button
											type="button"
											onclick={cancelEditing}
											class="neo-btn text-xs py-1 px-2 text-text-muted"
										>
											Cancel
										</button>
									</div>
									{#if editError}
										<p class="font-mono text-[10px] text-rose-500 font-bold">{editError}</p>
									{/if}
								</div>
							{:else}
								<!-- Standard Display Row -->
								<div class="flex items-center gap-2.5 min-w-0">
									<div class="h-3 w-3 bg-accent-contrast shrink-0"></div>
									<span class="font-sans text-sm font-black uppercase tracking-tight text-text-primary truncate">
										{sub.name}
									</span>
								</div>

								<div class="flex items-center gap-2 shrink-0 font-mono text-xs">
									<span class="neo-badge bg-muted text-text-secondary text-[11px] font-bold">
										{testCount} {testCount === 1 ? 'test' : 'tests'}
									</span>

									<!-- Edit Button -->
									<button
										type="button"
										onclick={() => startEditing(sub.id, sub.name)}
										class="neo-btn text-xs py-1 px-2.5 hover:bg-muted"
										title="Rename Subject"
									>
										✏️
									</button>

									<!-- Delete Button -->
									{#if confirmingDeleteId === sub.id}
										<div class="flex items-center gap-1">
											<button
												type="button"
												onclick={() => handleDeleteClick(sub.id)}
												class="neo-btn neo-btn-danger text-[11px] py-1 px-2"
												title="Confirm delete subject"
											>
												Confirm
											</button>
											<button
												type="button"
												onclick={() => (confirmingDeleteId = null)}
												class="neo-btn text-[11px] py-1 px-1.5"
												title="Cancel"
											>
												✕
											</button>
										</div>
									{:else}
										<button
											type="button"
											onclick={() => handleDeleteClick(sub.id)}
											disabled={app.subjects.subjects.length <= 1}
											class={`neo-btn text-xs py-1 px-2.5 ${
												app.subjects.subjects.length <= 1
													? 'opacity-30 cursor-not-allowed'
													: 'text-rose-500 hover:bg-rose-600 hover:text-white'
											}`}
											title={app.subjects.subjects.length <= 1
												? 'Cannot delete the only remaining subject'
												: testCount > 0
													? `Delete subject (Linked tests will move to general)`
													: 'Delete subject'}
										>
											🗑️
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<!-- Footer -->
			<div class="flex justify-end pt-3 border-t border-border-color/30">
				<button
					type="button"
					onclick={handleClose}
					class="neo-btn neo-btn-primary text-xs py-2 px-5 font-bold"
				>
					Done
				</button>
			</div>
		</div>
	</div>
{/if}
