<script lang="ts">
import MathRenderer from '$lib/components/common/MathRenderer.svelte';
import type { QuestionOption, QuestionPreview, QuestionType } from '$lib/types/test';
import QuestionOptionsEditor from './QuestionOptionsEditor.svelte';

interface Props {
	question: QuestionPreview;
	questionIndex: number;
	totalQuestions: number;
	onupdate: (updated: QuestionPreview) => void;
	ondelete: () => void;
}

const { question, questionIndex, totalQuestions, onupdate, ondelete }: Props = $props();

let isStatementPreviewing = $state(false);
let isHintPreviewing = $state(false);
let isExplanationPreviewing = $state(false);
let isConfirmingDelete = $state(false);

const isMulti = $derived(
	question.type === 'multi_choice' || question.type === 'multiple_choice_multi'
);
const isNumerical = $derived(question.type === 'numerical');

function handleTypeChange(newType: QuestionType) {
	const currentOptions = question.options || [];
	const updated: QuestionPreview = {
		...question,
		type: newType,
	};

	if (newType === 'numerical') {
		updated.correctAnswer = updated.correctAnswer || '0';
	} else if (newType === 'multi_choice' || newType === 'multiple_choice_multi') {
		if (currentOptions.length === 0) {
			updated.options = [
				{ id: 'opt_1', text: 'Option A' },
				{ id: 'opt_2', text: 'Option B' },
				{ id: 'opt_3', text: 'Option C' },
				{ id: 'opt_4', text: 'Option D' },
			];
			updated.correctAnswers = ['opt_1'];
		} else {
			updated.correctAnswers =
				question.correctAnswers ||
				(question.correctAnswer ? [question.correctAnswer] : [currentOptions[0].id]);
		}
	} else {
		// Single choice
		if (currentOptions.length === 0) {
			updated.options = [
				{ id: 'opt_1', text: 'Option A' },
				{ id: 'opt_2', text: 'Option B' },
				{ id: 'opt_3', text: 'Option C' },
				{ id: 'opt_4', text: 'Option D' },
			];
			updated.correctAnswer = 'opt_1';
		} else {
			updated.correctAnswer =
				question.correctAnswer || question.correctAnswers?.[0] || currentOptions[0].id;
		}
	}

	onupdate(updated);
}

function handleStatementChange(val: string) {
	onupdate({ ...question, text: val });
}

function handleMarksChange(marksVal: string) {
	const num = Number.parseFloat(marksVal);
	onupdate({ ...question, marks: Number.isNaN(num) ? 0 : Math.max(0, num) });
}

function handleNegativeMarksChange(negVal: string) {
	const num = Number.parseFloat(negVal);
	onupdate({ ...question, negativeMarks: Number.isNaN(num) ? 0 : Math.max(0, num) });
}

function handleOptionsUpdate(options: QuestionOption[]) {
	onupdate({ ...question, options });
}

function handleSelectCorrectSingle(optId: string) {
	onupdate({ ...question, correctAnswer: optId, correctAnswers: [optId] });
}

function handleToggleCorrectMulti(optId: string) {
	const current = question.correctAnswers || [];
	const exists = current.includes(optId);
	const next = exists ? current.filter((id) => id !== optId) : [...current, optId];
	onupdate({
		...question,
		correctAnswers: next,
		correctAnswer: next[0] || '',
	});
}

function handleNumericalAnswerChange(val: string) {
	onupdate({ ...question, correctAnswer: val });
}

function handleHintChange(val: string) {
	onupdate({ ...question, hint: val });
}

function handleExplanationChange(val: string) {
	onupdate({ ...question, explanation: val });
}
</script>

<div class="neo-box p-4 sm:p-6 bg-surface space-y-5 border-2 border-border-color">
	<!-- Question Control Header -->
	<div class="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border-color/30 pb-3.5">
		<div class="flex items-center gap-2">
			<span class="font-mono text-sm sm:text-base font-black uppercase text-text-primary">
				Question #{question.questionNumber}
			</span>
			<span class="font-mono text-xs text-text-muted">
				(Item {questionIndex + 1} of {totalQuestions})
			</span>
		</div>

		<!-- Question Type & Delete Button -->
		<div class="flex flex-wrap items-center gap-2">
			<!-- Question Type Selector -->
			<select
				value={question.type}
				onchange={(e) => handleTypeChange(e.currentTarget.value as QuestionType)}
				class="neo-input font-mono text-xs py-1.5 px-2.5 cursor-pointer font-bold"
			>
				<option value="single_choice">◉ Single Choice</option>
				<option value="multi_choice">☑ Multiple Choice (Multi-Correct)</option>
				<option value="numerical"># Numerical Answer</option>
			</select>

			{#if isConfirmingDelete}
				<div class="flex items-center gap-1">
					<button
						type="button"
						onclick={() => {
							isConfirmingDelete = false;
							ondelete();
						}}
						class="neo-btn neo-btn-danger text-xs py-1 px-2.5"
					>
						Confirm Delete
					</button>
					<button
						type="button"
						onclick={() => (isConfirmingDelete = false)}
						class="neo-btn text-xs py-1 px-2"
					>
						✕
					</button>
				</div>
			{:else}
				<button
					type="button"
					onclick={() => (isConfirmingDelete = true)}
					disabled={totalQuestions <= 1}
					class="neo-btn text-xs py-1 px-2.5 text-rose-500 hover:bg-rose-600 hover:text-white border-rose-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
					title="Delete question"
				>
					🗑️ Delete
				</button>
			{/if}
		</div>
	</div>

	<!-- Scoring Controls -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/30 border border-border-color/30 font-mono text-xs">
		<div class="space-y-1">
			<label for="q-marks" class="block font-bold text-text-secondary uppercase text-[10px]">
				Positive Marks (+)
			</label>
			<input
				id="q-marks"
				type="number"
				step="0.5"
				min="0"
				value={question.marks}
				oninput={(e) => handleMarksChange(e.currentTarget.value)}
				class="neo-input w-full font-bold py-1 px-2 text-xs"
			/>
		</div>
		<div class="space-y-1">
			<label for="q-neg-marks" class="block font-bold text-text-secondary uppercase text-[10px]">
				Negative Marks (-)
			</label>
			<input
				id="q-neg-marks"
				type="number"
				step="0.5"
				min="0"
				value={question.negativeMarks ?? 0}
				oninput={(e) => handleNegativeMarksChange(e.currentTarget.value)}
				class="neo-input w-full font-bold py-1 px-2 text-xs"
			/>
		</div>
		<div class="col-span-2 flex items-center justify-end text-[11px] text-text-muted pt-3 font-mono">
			<span>Net: +{question.marks} / -{question.negativeMarks ?? 0}</span>
		</div>
	</div>

	<!-- Diagram Figure preview if attached -->
	{#if question.associatedDiagramUrl}
		<div class="p-2.5 bg-muted/40 border border-border-color flex items-center gap-3">
			<img
				src={question.associatedDiagramUrl}
				alt="Linked figure thumbnail"
				class="h-14 w-auto object-contain bg-white border border-border-color/30"
			/>
			<div class="text-xs font-mono">
				<span class="font-bold text-text-primary block">Linked Figure Asset</span>
				<span class="text-text-muted text-[10px]">{question.associatedDiagramId || 'Embedded Diagram'}</span>
			</div>
		</div>
	{/if}

	<!-- Question Statement (Markdown + KaTeX) -->
	<div class="space-y-1.5">
		<div class="flex items-center justify-between">
			<label for="q-statement" class="block font-mono text-xs font-bold uppercase text-text-secondary">
				Question Statement (Markdown & LaTeX) <span class="text-rose-500">*</span>
			</label>
			<button
				type="button"
				onclick={() => (isStatementPreviewing = !isStatementPreviewing)}
				class="font-mono text-xs px-2 py-0.5 border border-border-color bg-surface hover:bg-muted font-bold text-text-primary uppercase"
			>
				{isStatementPreviewing ? '✏️ Edit Markdown' : '👁️ Live Preview'}
			</button>
		</div>

		{#if isStatementPreviewing}
			<div class="p-4 bg-muted/20 border-2 border-border-color min-h-[100px] text-sm leading-relaxed">
				<MathRenderer content={question.text} />
			</div>
		{:else}
			<textarea
				id="q-statement"
				rows="4"
				value={question.text}
				oninput={(e) => handleStatementChange(e.currentTarget.value)}
				placeholder="Enter question text with standard Markdown and LaTeX math ($...$ or $$...$$)..."
				class="neo-input w-full font-mono text-xs resize-y"
			></textarea>
		{/if}
	</div>

	<!-- Options or Numerical Answer Input -->
	{#if isNumerical}
		<div class="p-4 bg-muted/30 border-2 border-border-color space-y-2">
			<label for="q-num-correct" class="block font-mono text-xs font-bold uppercase text-text-primary">
				Correct Numerical Answer Value <span class="text-rose-500">*</span>
			</label>
			<input
				id="q-num-correct"
				type="text"
				value={question.correctAnswer || ''}
				oninput={(e) => handleNumericalAnswerChange(e.currentTarget.value)}
				placeholder="e.g. 42.5 or -10"
				class="neo-input max-w-sm font-mono text-sm"
			/>
			<span class="text-[10px] font-mono text-text-muted block">
				Evaluated within ±0.01 tolerance during examination scoring.
			</span>
		</div>
	{:else}
		<QuestionOptionsEditor
			options={question.options || []}
			{isMulti}
			correctAnswer={question.correctAnswer}
			correctAnswers={question.correctAnswers}
			onupdateoptions={handleOptionsUpdate}
			onselectcorrectsingle={handleSelectCorrectSingle}
			ontogglecorrectmulti={handleToggleCorrectMulti}
		/>
	{/if}

	<!-- Hint & Explanation Collapsible Fields -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border-color/30">
		<!-- Practice Hint -->
		<div class="space-y-1.5">
			<div class="flex items-center justify-between">
				<label for="q-hint" class="block font-mono text-xs font-bold uppercase text-amber-700 dark:text-amber-300">
					💡 Practice Mode Hint (Optional)
				</label>
				<button
					type="button"
					onclick={() => (isHintPreviewing = !isHintPreviewing)}
					class="font-mono text-[10px] px-1.5 py-0.5 border border-border-color bg-surface hover:bg-muted font-bold text-text-primary uppercase"
				>
					{isHintPreviewing ? 'Edit' : 'Preview'}
				</button>
			</div>

			{#if isHintPreviewing}
				<div class="p-3 bg-amber-500/10 border border-amber-500/40 text-xs min-h-[70px]">
					<MathRenderer content={question.hint || '*No hint set.*'} />
				</div>
			{:else}
				<textarea
					id="q-hint"
					rows="3"
					value={question.hint || ''}
					oninput={(e) => handleHintChange(e.currentTarget.value)}
					placeholder="Directional hint for practice mode..."
					class="neo-input w-full font-mono text-xs resize-none"
				></textarea>
			{/if}
		</div>

		<!-- Explanation / Solution -->
		<div class="space-y-1.5">
			<div class="flex items-center justify-between">
				<label for="q-explanation" class="block font-mono text-xs font-bold uppercase text-indigo-700 dark:text-indigo-300">
					✓ Step-by-Step Explanation (Optional)
				</label>
				<button
					type="button"
					onclick={() => (isExplanationPreviewing = !isExplanationPreviewing)}
					class="font-mono text-[10px] px-1.5 py-0.5 border border-border-color bg-surface hover:bg-muted font-bold text-text-primary uppercase"
				>
					{isExplanationPreviewing ? 'Edit' : 'Preview'}
				</button>
			</div>

			{#if isExplanationPreviewing}
				<div class="p-3 bg-indigo-500/10 border border-indigo-500/40 text-xs min-h-[70px]">
					<MathRenderer content={question.explanation || '*No explanation set.*'} />
				</div>
			{:else}
				<textarea
					id="q-explanation"
					rows="3"
					value={question.explanation || ''}
					oninput={(e) => handleExplanationChange(e.currentTarget.value)}
					placeholder="Step-by-step solution and explanation..."
					class="neo-input w-full font-mono text-xs resize-none"
				></textarea>
			{/if}
		</div>
	</div>
</div>
