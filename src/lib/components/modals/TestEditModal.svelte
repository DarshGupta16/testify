<script lang="ts">
import { v4 as uuidv4 } from 'uuid';
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { QuestionPreview, TestItem } from '$lib/types/test';
import QuestionItemEditor from './edit/QuestionItemEditor.svelte';
import QuestionListPalette from './edit/QuestionListPalette.svelte';
import TestMetadataEditForm from './edit/TestMetadataEditForm.svelte';

const app = getAppContext();

// Local working draft state
let draftTitle = $state<string>('');
let draftSubjectId = $state<string>('');
let draftDurationMinutes = $state<number | null>(null);
let draftDescription = $state<string>('');
let draftQuestions = $state<QuestionPreview[]>([]);
let selectedQuestionIndex = $state<number>(0);
let lastLoadedId: string | null = null;

// Sync draft with editingTest when modal opens for a test
$effect(() => {
	if (app.modals.isEditModalOpen && app.modals.editingTest) {
		if (lastLoadedId !== app.modals.editingTest.id) {
			lastLoadedId = app.modals.editingTest.id;
			const test = app.modals.editingTest;
			draftTitle = test.title;
			draftSubjectId = test.subjectId;
			draftDurationMinutes = test.durationMinutes;
			draftDescription = test.description || '';

			const qs = test.questions ? JSON.parse(JSON.stringify(test.questions)) : [];
			if (qs.length === 0) {
				qs.push(createDefaultQuestion(1));
			}
			draftQuestions = qs;
			selectedQuestionIndex = 0;
		}
	} else {
		lastLoadedId = null;
	}
});

function createDefaultQuestion(questionNumber: number): QuestionPreview {
	const optA = `opt_${uuidv4().slice(0, 8)}`;
	const optB = `opt_${uuidv4().slice(0, 8)}`;
	const optC = `opt_${uuidv4().slice(0, 8)}`;
	const optD = `opt_${uuidv4().slice(0, 8)}`;

	return {
		id: `q_${uuidv4().slice(0, 8)}`,
		questionNumber,
		type: 'single_choice',
		text: 'Enter question text in **Markdown** with math: $x^2 + y^2 = r^2$',
		options: [
			{ id: optA, text: 'Option A' },
			{ id: optB, text: 'Option B' },
			{ id: optC, text: 'Option C' },
			{ id: optD, text: 'Option D' },
		],
		correctAnswer: optA,
		correctAnswers: [optA],
		marks: 4,
		negativeMarks: 1,
		hint: '',
		explanation: '',
	};
}

const computedTotalMarks = $derived(
	Math.round(draftQuestions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0) * 100) / 100
);

const activeQuestion = $derived(draftQuestions[selectedQuestionIndex] || draftQuestions[0]);

function handleAddQuestion() {
	const nextNum = draftQuestions.length + 1;
	const newQ = createDefaultQuestion(nextNum);
	draftQuestions = [...draftQuestions, newQ];
	selectedQuestionIndex = draftQuestions.length - 1;
}

function handleDeleteQuestion(index: number) {
	if (draftQuestions.length <= 1) {
		app.toast.show('Assessment must have at least one question.', 'warning');
		return;
	}

	const updated = draftQuestions
		.filter((_, i) => i !== index)
		.map((q, i) => ({ ...q, questionNumber: i + 1 }));

	draftQuestions = updated;
	if (selectedQuestionIndex >= updated.length) {
		selectedQuestionIndex = updated.length - 1;
	}
}

function handleUpdateQuestion(updatedQ: QuestionPreview) {
	draftQuestions = draftQuestions.map((q, i) => (i === selectedQuestionIndex ? updatedQ : q));
}

function handleSave() {
	if (!draftTitle.trim()) {
		app.toast.show('Please provide a valid test title.', 'error');
		return;
	}

	if (draftQuestions.length === 0) {
		app.toast.show('Assessment must contain at least one question.', 'error');
		return;
	}

	// Validate questions text
	const hasEmptyQuestion = draftQuestions.some((q) => !q.text.trim());
	if (hasEmptyQuestion) {
		app.toast.show(
			'One or more questions have empty question statements. Please fill them.',
			'warning'
		);
	}

	if (!app.modals.editingTest) return;

	const plainEditingTest = JSON.parse(JSON.stringify(app.modals.editingTest));
	delete plainEditingTest.tags;
	delete plainEditingTest.questionCount;
	const plainQuestions = JSON.parse(JSON.stringify(draftQuestions));

	const updatedTestItem: TestItem = {
		...plainEditingTest,
		title: draftTitle.trim(),
		subjectId: draftSubjectId,
		durationMinutes: draftDurationMinutes,
		description: draftDescription.trim(),
		questions: plainQuestions,
		totalMarks: computedTotalMarks,
	};

	app.handleUpdateTest(updatedTestItem);
}

function handleKeyDown(e: KeyboardEvent) {
	if (!app.modals.isEditModalOpen) return;

	if (e.key === 'Escape') {
		app.modals.closeEdit();
	} else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
		e.preventDefault();
		handleSave();
	}
}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if app.modals.isEditModalOpen && app.modals.editingTest}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs animate-fade-in"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				app.modals.closeEdit();
			}
		}}
		role="presentation"
	>
		<!-- Modal Dialog Container -->
		<div
			class="neo-box-lg w-full max-w-5xl bg-surface p-4 sm:p-7 animate-slide-down max-h-[94vh] flex flex-col overflow-hidden"
			role="dialog"
			aria-modal="true"
			aria-labelledby="edit-modal-title"
		>
			<!-- Modal Header Bar -->
			<div class="flex items-center justify-between border-b-2 border-border-color pb-3 sm:pb-4 mb-3 sm:mb-4 shrink-0">
				<div class="flex items-center gap-2 sm:gap-2.5">
					<div class="h-3.5 w-3.5 sm:h-4 sm:w-4 bg-accent-contrast"></div>
					<h2 id="edit-modal-title" class="text-sm sm:text-xl font-black uppercase tracking-wide text-text-primary">
						Edit Assessment & Questions
					</h2>
				</div>

				<div class="flex items-center gap-1.5 sm:gap-2">
					<button
						type="button"
						onclick={handleSave}
						class="neo-btn neo-btn-primary text-xs py-1.5 px-2.5 sm:px-3 font-bold truncate"
					>
						💾 Save
					</button>
					<button
						type="button"
						onclick={() => app.modals.closeEdit()}
						class="neo-btn text-xs py-1 px-2.5"
						aria-label="Close edit modal"
					>
						✕
					</button>
				</div>
			</div>

			<!-- Scrollable Form Body -->
			<div class="flex-1 overflow-y-auto space-y-4 sm:space-y-6 pr-1">
				<!-- Section 1: Test Metadata -->
				<TestMetadataEditForm
					title={draftTitle}
					subjectId={draftSubjectId}
					durationMinutes={draftDurationMinutes}
					description={draftDescription}
					subjects={app.subjects.subjects}
					ontitlechange={(val) => (draftTitle = val)}
					onsubjectchange={(val) => (draftSubjectId = val)}
					ondurationchange={(val) => (draftDurationMinutes = val)}
					ondescriptionchange={(val) => (draftDescription = val)}
				/>

				<!-- Section 2: Questions Editor -->
				<div class="space-y-3">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
						<h3 class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
							<span>📝</span>
							<span>Question Content & Configuration</span>
						</h3>
						<span class="font-mono text-[11px] sm:text-xs text-text-muted">
							{draftQuestions.length} Total Questions • {computedTotalMarks} Total Marks
						</span>
					</div>

					<!-- Responsive Layout: Question Palette + Active Question Editor -->
					<div class="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
						<!-- Left Question Palette Sidebar -->
						<div class="lg:col-span-1">
							<QuestionListPalette
								questions={draftQuestions}
								selectedIndex={selectedQuestionIndex}
								onselect={(idx) => (selectedQuestionIndex = idx)}
								onadd={handleAddQuestion}
							/>
						</div>

						<!-- Right Active Question Editor -->
						<div class="lg:col-span-3">
							{#if activeQuestion}
								<QuestionItemEditor
									question={activeQuestion}
									questionIndex={selectedQuestionIndex}
									totalQuestions={draftQuestions.length}
									onupdate={handleUpdateQuestion}
									ondelete={() => handleDeleteQuestion(selectedQuestionIndex)}
								/>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Modal Sticky Footer Summary & Actions -->
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t-2 border-border-color mt-3 sm:mt-4 shrink-0 font-mono text-xs">
				<div class="flex flex-wrap items-center gap-1.5 sm:gap-2 text-text-secondary text-[11px] sm:text-xs">
					<span class="font-bold text-text-primary">{draftQuestions.length} Qs</span>
					<span>•</span>
					<span class="font-bold text-emerald-600 dark:text-emerald-400">{computedTotalMarks} Marks</span>
					<span>•</span>
					<span>{draftDurationMinutes ? `${draftDurationMinutes} Mins` : 'Untimed'}</span>
				</div>

				<div class="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
					<button
						type="button"
						onclick={() => app.modals.closeEdit()}
						class="neo-btn text-xs py-2 px-3 sm:px-4 text-center truncate"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={handleSave}
						class="neo-btn neo-btn-primary text-xs py-2 px-3 sm:px-5 font-bold text-center truncate"
					>
						💾 Save Changes
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
