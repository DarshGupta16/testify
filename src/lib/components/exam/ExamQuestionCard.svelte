<script lang="ts">
import MathRenderer from '$lib/components/common/MathRenderer.svelte';
import { hasResponseAnswer } from '$lib/services/assessmentEvaluator';
import type { QuestionPreview, TestMode, UserQuestionResponse } from '$lib/types/test';
import { formatSecondsToText } from '$lib/utils';

const {
	question,
	questionIndex,
	totalQuestions,
	response,
	mode = 'exam',
	showHint = false,
	showPracticeSolution = false,
	onselectsingle,
	ontogglemulti,
	oninputnumerical,
	onclearresponse,
	ontogglereview,
	ontogglehint,
	ontogglesolution,
	onnext,
	onprevious,
	onmarkandnext,
	onzoom,
}: {
	question: QuestionPreview;
	questionIndex: number;
	totalQuestions: number;
	response: UserQuestionResponse | undefined;
	mode?: TestMode;
	showHint?: boolean;
	showPracticeSolution?: boolean;
	onselectsingle: (optId: string) => void;
	ontogglemulti: (optId: string) => void;
	oninputnumerical: (val: string) => void;
	onclearresponse: () => void;
	ontogglereview?: () => void;
	ontogglehint: () => void;
	ontogglesolution: () => void;
	onnext: () => void;
	onprevious: () => void;
	onmarkandnext: () => void;
	onzoom: (item: { title: string; src: string; info?: string }) => void;
} = $props();

const isMulti = $derived(
	question.type === 'multi_choice' || question.type === 'multiple_choice_multi'
);

const isSingle = $derived(question.type === 'single_choice' || question.type === 'multiple_choice');

const isNumerical = $derived(question.type === 'numerical');

const selectedMultiList = $derived(
	response?.selectedOptionIds || (response?.selectedOptionId ? [response.selectedOptionId] : [])
);

const hasAnswer = $derived(hasResponseAnswer(response));
</script>

<div class="neo-box p-5 sm:p-7 bg-surface space-y-6 animate-fade-in">
	<!-- Question Header Bar -->
	<div class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border-color/20 pb-3">
		<div class="flex items-center gap-2">
			<span class="text-base sm:text-lg font-black uppercase text-text-primary">
				Question {questionIndex + 1}
			</span>
			<span class="font-mono text-xs text-text-muted">
				of {totalQuestions}
			</span>
			<!-- Current Question Time Badge -->
			{#if response?.timeSpentSeconds && response.timeSpentSeconds > 0}
				<span class="font-mono text-[11px] text-text-muted bg-muted px-2 py-0.5 border border-border-color/30">
					⏱️ {formatSecondsToText(response.timeSpentSeconds)}
				</span>
			{/if}
		</div>

		<div class="flex items-center gap-1.5">
			{#if isMulti}
				<span class="neo-badge bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/40 text-[10px] uppercase font-bold">
					☑ Single Choice
				</span>
			{:else if isSingle}
				<span class="neo-badge bg-muted text-[10px] uppercase font-bold text-text-secondary">
					◉ Single Choice
				</span>
			{:else}
				<span class="neo-badge bg-muted text-[10px] uppercase font-bold text-text-secondary">
					# Numerical
				</span>
			{/if}

			<span class="neo-badge bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
				+{question.marks} Marks
			</span>
			{#if question.negativeMarks && question.negativeMarks > 0 && mode === 'exam'}
				<span class="neo-badge bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/40 text-[10px] font-bold">
					-{question.negativeMarks} Neg
				</span>
			{/if}
		</div>
	</div>

	<!-- Associated Diagram Figure -->
	{#if question.associatedDiagramUrl}
		<div class="p-3 bg-muted/30 border-2 border-border-color inline-block max-w-full">
			<button
				type="button"
				onclick={() =>
					onzoom({
						title: `Question #${question.questionNumber} - Figure`,
						src: question.associatedDiagramUrl!,
						info: `Linked figure ${question.associatedDiagramId || ''}`,
					})}
				class="cursor-pointer group flex flex-col items-start gap-1"
			>
				<img
					src={question.associatedDiagramUrl}
					alt={`Figure for Question ${question.questionNumber}`}
					class="max-h-56 max-w-full object-contain bg-white border border-border-color/30 group-hover:scale-[1.01] transition-transform"
				/>
				<span class="font-mono text-[10px] text-accent-contrast underline">
					🔍 Click diagram to enlarge
				</span>
			</button>
		</div>
	{/if}

	<!-- Question Statement (KaTeX + Markdown with preserved linebreaks) -->
	<div class="text-sm sm:text-base font-normal leading-relaxed text-text-primary">
		<MathRenderer content={question.text} />
	</div>

	<!-- Practice Mode: Hint & Solution Helpers -->
	{#if mode === 'practice'}
		<div class="space-y-3 pt-1 border-t border-border-color/20">
			<div class="flex flex-wrap items-center gap-2">
				{#if question.hint}
					<button
						type="button"
						onclick={ontogglehint}
						class={`neo-btn text-xs py-1.5 px-3 font-mono uppercase font-bold tracking-wider ${
							showHint
								? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500'
								: 'bg-surface hover:bg-muted text-text-secondary'
						}`}
					>
						💡 {showHint ? 'Hide Hint' : 'Show Hint'}
					</button>
				{/if}

				<button
					type="button"
					onclick={ontogglesolution}
					class={`neo-btn text-xs py-1.5 px-3 font-mono uppercase font-bold tracking-wider ${
						showPracticeSolution
							? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500'
							: 'bg-surface hover:bg-muted text-text-secondary'
					}`}
				>
					👁️ {showPracticeSolution ? 'Hide Solution' : 'Check Solution'}
				</button>
			</div>

			<!-- Expandable Hint Card -->
			{#if showHint && question.hint}
				<div class="p-3.5 bg-amber-500/10 border-2 border-amber-500/60 text-xs font-mono space-y-1 animate-slide-down">
					<span class="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
						💡 Practice Hint:
					</span>
					<div class="text-text-primary pl-4 border-l-2 border-amber-500/40">
						<MathRenderer content={question.hint} />
					</div>
				</div>
			{/if}

			<!-- Expandable Practice Solution Card -->
			{#if showPracticeSolution}
				<div class="p-4 bg-indigo-500/10 border-2 border-indigo-500/60 text-xs font-mono space-y-2 animate-slide-down">
					<span class="font-bold text-indigo-700 dark:text-indigo-300 block">
						✓ Solution & Step-by-Step Explanation:
					</span>

					{#if isMulti}
						{@const correctIds = question.correctAnswers || (question.correctAnswer ? [question.correctAnswer] : [])}
						<div class="font-bold text-emerald-600 dark:text-emerald-400 space-y-1">
							<span>Correct Options ({correctIds.length}):</span>
							<div class="flex flex-wrap gap-1.5 pt-1">
								{#each correctIds as cId}
									{@const optObj = question.options?.find((o) => o.id === cId)}
									<span class="px-2 py-0.5 border border-emerald-500/40 bg-emerald-500/10 text-xs">
										<MathRenderer content={optObj ? optObj.text : cId} inline={true} />
									</span>
								{/each}
							</div>
						</div>
					{:else if question.correctAnswer}
						{@const matchingOpt = question.options?.find((o) => o.id === question.correctAnswer)}
						<div class="font-bold text-emerald-600 dark:text-emerald-400 flex items-center flex-wrap gap-1">
							<span>Correct Answer:</span>
							<MathRenderer content={matchingOpt ? matchingOpt.text : question.correctAnswer} inline={true} />
						</div>
					{/if}

					{#if question.explanation}
						<div class="text-text-primary pl-3 border-l-2 border-indigo-500/40 pt-1">
							<MathRenderer content={question.explanation} />
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Input / Options Section -->
	<div class="pt-2">
		{#if isSingle || isMulti}
			<div class="space-y-3">
				{#if isMulti}
					<div class="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 p-2 border border-indigo-500/30 flex items-center gap-1.5">
						<span>☑</span>
						<span>Multiple options may be correct. Select all that apply.</span>
					</div>
				{/if}

				{#if question.options && question.options.length > 0}
					{#each question.options as opt, optIdx}
						{@const optText = typeof opt === 'string' ? opt : opt.text}
						{@const optId = typeof opt === 'string' ? opt : opt.id}
						{@const isSelected = isMulti
							? selectedMultiList.includes(optId)
							: response?.selectedOptionId === optId}
						{@const letter = String.fromCharCode(65 + optIdx)}

						<button
							type="button"
							onclick={() => (isMulti ? ontogglemulti(optId) : onselectsingle(optId))}
							class={`w-full p-3.5 sm:p-4 text-left border-2 flex items-start gap-3.5 transition-all cursor-pointer ${
								isSelected
									? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[3px_3px_0px_var(--shadow-color)] -translate-y-0.5'
									: 'bg-surface hover:bg-muted/50 border-border-color'
							}`}
						>
							<span
								class={`flex h-7 w-7 shrink-0 items-center justify-center font-mono text-xs font-bold border-2 ${
									isSelected
										? 'bg-accent-contrast-text text-accent-contrast border-accent-contrast-text'
										: 'bg-muted border-border-color text-text-primary'
								}`}
							>
								{isMulti ? (isSelected ? '✓' : letter) : letter}
							</span>
							<div class="flex-1 text-xs sm:text-sm pt-0.5 break-words">
								<MathRenderer content={optText} inline={true} />
							</div>
						</button>
					{/each}
				{:else}
					<div class="p-4 border-2 border-dashed border-border-color text-center text-xs font-mono text-text-muted">
						No options provided for this question.
					</div>
				{/if}
			</div>
		{:else if isNumerical}
			<!-- Numerical Answer Input -->
			<div class="max-w-md space-y-2">
				<label for="num-input" class="block font-mono text-xs font-bold uppercase text-text-muted">
					Enter Numerical Answer:
				</label>
				<div class="flex items-center gap-2">
					<input
						id="num-input"
						type="text"
						value={response?.numericalAnswer || ''}
						oninput={(e) => oninputnumerical(e.currentTarget.value)}
						placeholder="e.g. 45.0"
						class="neo-input flex-1 font-mono text-base"
					/>
					{#if response?.numericalAnswer}
						<button
							type="button"
							onclick={onclearresponse}
							class="neo-btn text-xs py-2 px-3"
							title="Clear answer"
						>
							✕
						</button>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Action Toolbar -->
	<div class="flex flex-wrap items-center justify-between gap-3 pt-6 border-t-2 border-border-color/20">
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={onprevious}
				disabled={questionIndex === 0}
				class="neo-btn text-xs py-2 px-3.5 disabled:opacity-40 disabled:cursor-not-allowed uppercase font-bold tracking-wider"
			>
				&larr; Previous
			</button>
			<button
				type="button"
				onclick={onclearresponse}
				disabled={!hasAnswer}
				class="neo-btn text-xs py-2 px-3.5 disabled:opacity-40 disabled:cursor-not-allowed uppercase font-bold tracking-wider"
			>
				Clear
			</button>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={onmarkandnext}
				class={`neo-btn text-xs py-2 px-3.5 uppercase font-bold tracking-wider ${
					response?.isMarkedForReview
						? 'bg-purple-600 text-white border-purple-700'
						: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/40'
				}`}
			>
				{response?.isMarkedForReview ? '★ Marked for Review' : '☆ Mark & Next'}
			</button>
			<button
				type="button"
				onclick={onnext}
				class="neo-btn neo-btn-primary text-xs py-2 px-4 uppercase font-bold tracking-wider"
			>
				<span>{questionIndex === totalQuestions - 1 ? 'Save & Review' : 'Save & Next →'}</span>
			</button>
		</div>
	</div>
</div>
