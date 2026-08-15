<script lang="ts">
import MathRenderer from '$lib/components/common/MathRenderer.svelte';
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
	ontogglereview: () => void;
	ontogglehint: () => void;
	ontogglesolution: () => void;
	onnext: () => void;
	onprevious: () => void;
	onmarkandnext: () => void;
	onzoom: (item: { title: string; src: string; info?: string }) => void;
} = $props();

const selectedMultiList = $derived(
	response?.selectedOptionIds || (response?.selectedOptionId ? [response.selectedOptionId] : [])
);
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
			{#if response?.timeSpentSeconds && response.timeSpentSeconds > 0}
				<span class="font-mono text-[11px] text-text-muted bg-muted px-2 py-0.5 border border-border-color/30">
					⏱️ {formatSecondsToText(response.timeSpentSeconds)}
				</span>
			{/if}
		</div>

		<div class="flex items-center gap-1.5">
			{#if question.type === 'multi_choice' || question.type === 'multiple_choice_multi'}
				<span class="neo-badge bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/40 text-[10px] uppercase font-bold">
					☑ Multi-Choice (Multi-Correct)
				</span>
			{:else if question.type === 'single_choice' || question.type === 'multiple_choice'}
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
					alt="Figure for Question {question.questionNumber}"
					class="max-h-56 max-w-full object-contain bg-white border border-border-color/30 group-hover:scale-[1.01] transition-transform"
				/>
				<span class="font-mono text-[10px] text-accent-contrast underline">
					🔍 Click diagram to enlarge
				</span>
			</button>
		</div>
	{/if}

	<!-- Question Text -->
	<div class="text-base sm:text-lg font-medium text-text-primary leading-relaxed">
		<MathRenderer content={question.text} />
	</div>

	<!-- Answer Options / Input Area -->
	<div class="space-y-3 pt-2">
		{#if question.type === 'single_choice' || question.type === 'multiple_choice'}
			<!-- 1. Single Choice Options -->
			<div class="grid grid-cols-1 gap-2.5">
				{#each question.options || [] as opt, optIdx}
					{@const isSelected = response?.selectedOptionId === opt.id}
					<button
						type="button"
						onclick={() => onselectsingle(opt.id)}
						class={`w-full p-4 border-2 flex items-start gap-3.5 text-left transition-all cursor-pointer ${
							isSelected
								? 'bg-accent-contrast text-accent-contrast-text border-border-color shadow-[3px_3px_0px_var(--shadow-color)]'
								: 'bg-surface hover:bg-muted/40 border-border-color/60'
						}`}
					>
						<span
							class={`flex h-6 w-6 shrink-0 items-center justify-center border-2 font-mono text-xs font-bold rounded-full ${
								isSelected
									? 'border-accent-contrast-text bg-accent-contrast-text text-accent-contrast'
									: 'border-border-color bg-muted text-text-secondary'
							}`}
						>
							{String.fromCharCode(65 + optIdx)}
						</span>
						<div class="text-sm font-medium flex-1 pt-0.5 break-words">
							<MathRenderer content={opt.text} inline={true} />
						</div>
					</button>
				{/each}
			</div>

		{:else if question.type === 'multi_choice' || question.type === 'multiple_choice_multi'}
			<!-- 2. Multi Choice (Multiple Correct) Options -->
			<div class="grid grid-cols-1 gap-2.5">
				<p class="font-mono text-xs text-text-muted italic mb-1">
					Select all correct options (partial marks awarded if only correct ones chosen):
				</p>
				{#each question.options || [] as opt, optIdx}
					{@const isSelected = selectedMultiList.includes(opt.id)}
					<button
						type="button"
						onclick={() => ontogglemulti(opt.id)}
						class={`w-full p-4 border-2 flex items-start gap-3.5 text-left transition-all cursor-pointer ${
							isSelected
								? 'bg-accent-contrast text-accent-contrast-text border-border-color shadow-[3px_3px_0px_var(--shadow-color)]'
								: 'bg-surface hover:bg-muted/40 border-border-color/60'
						}`}
					>
						<span
							class={`flex h-6 w-6 shrink-0 items-center justify-center border-2 font-mono text-xs font-bold ${
								isSelected
									? 'border-accent-contrast-text bg-accent-contrast-text text-accent-contrast'
									: 'border-border-color bg-muted text-text-secondary'
							}`}
						>
							{isSelected ? '✓' : String.fromCharCode(65 + optIdx)}
						</span>
						<div class="text-sm font-medium flex-1 pt-0.5 break-words">
							<MathRenderer content={opt.text} inline={true} />
						</div>
					</button>
				{/each}
			</div>

		{:else if question.type === 'numerical'}
			<!-- 3. Numerical Input -->
			<div class="max-w-md space-y-2">
				<label for="numerical-input" class="block font-mono text-xs font-bold uppercase text-text-muted">
					Enter Numerical Answer:
				</label>
				<div class="flex items-center gap-2">
					<input
						id="numerical-input"
						type="number"
						step="any"
						value={response?.numericalAnswer || ''}
						oninput={(e) => oninputnumerical((e.target as HTMLInputElement).value)}
						placeholder="e.g. 45.0"
						class="neo-input w-full text-base font-mono py-2.5"
					/>
					{#if response?.numericalAnswer}
						<button
							type="button"
							onclick={onclearresponse}
							class="neo-btn text-xs py-2.5 px-3"
						>
							Clear
						</button>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Practice Mode: Hint & Instant Derivation Box -->
	{#if mode === 'practice'}
		<div class="pt-2 border-t border-border-color/20 space-y-3">
			<div class="flex flex-wrap items-center gap-2">
				{#if question.hint}
					<button
						type="button"
						onclick={ontogglehint}
						class="neo-btn text-xs py-1.5 px-3 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/40"
					>
						💡 {showHint ? 'Hide Hint' : 'Show Hint'}
					</button>
				{/if}

				{#if question.explanation || question.correctAnswer || question.correctAnswers}
					<button
						type="button"
						onclick={ontogglesolution}
						class="neo-btn text-xs py-1.5 px-3 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
					>
						📖 {showPracticeSolution ? 'Hide Solution' : 'Check Correct Answer & Solution'}
					</button>
				{/if}
			</div>

			<!-- Hint Dropdown -->
			{#if showHint && question.hint}
				<div class="p-3.5 bg-indigo-500/10 border-2 border-indigo-500/30 text-xs animate-fade-in space-y-1">
					<span class="font-mono font-bold text-indigo-700 dark:text-indigo-300 uppercase block text-[11px]">
						Directional Practice Hint:
					</span>
					<div class="text-text-primary leading-relaxed">
						<MathRenderer content={question.hint} />
					</div>
				</div>
			{/if}

			<!-- Solution Dropdown -->
			{#if showPracticeSolution}
				<div class="p-4 bg-emerald-500/10 border-2 border-emerald-500/40 text-xs animate-fade-in space-y-2">
					<div class="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase flex items-center gap-2">
						<span>✓ Correct Answer:</span>
						{#if question.type === 'multi_choice' || question.type === 'multiple_choice_multi'}
							<span class="bg-emerald-500/20 px-2 py-0.5 border border-emerald-500/40">
								{(question.correctAnswers || []).join(', ')}
							</span>
						{:else}
							<span class="bg-emerald-500/20 px-2 py-0.5 border border-emerald-500/40">
								{question.correctAnswer || 'N/A'}
							</span>
						{/if}
					</div>

					{#if question.explanation}
						<div class="pt-2 border-t border-emerald-500/30">
							<span class="font-mono font-bold text-emerald-700 dark:text-emerald-300 uppercase block text-[11px] mb-1">
								Step-by-Step Derivation:
							</span>
							<div class="text-text-primary leading-relaxed">
								<MathRenderer content={question.explanation} />
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Question Action Bar -->
	<div class="flex flex-wrap items-center justify-between gap-3 pt-4 border-t-2 border-border-color">
		<!-- Left Sub-actions -->
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={ontogglereview}
				class={`neo-btn text-xs py-2 px-3.5 flex items-center gap-1.5 ${
					response?.isMarkedForReview
						? 'bg-amber-500 text-white border-amber-600 font-bold'
						: 'bg-surface'
				}`}
			>
				<span>{response?.isMarkedForReview ? '★ Marked for Review' : '☆ Mark for Review'}</span>
			</button>

			<button
				type="button"
				onclick={onclearresponse}
				class="neo-btn text-xs py-2 px-3 text-text-muted hover:text-text-primary"
			>
				Clear Response
			</button>
		</div>

		<!-- Right Navigation Buttons -->
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={onprevious}
				disabled={questionIndex === 0}
				class="neo-btn text-xs py-2 px-3.5 disabled:opacity-40"
			>
				&larr; Previous
			</button>

			{#if mode === 'exam' && questionIndex < totalQuestions - 1}
				<button
					type="button"
					onclick={onmarkandnext}
					class="neo-btn text-xs py-2 px-3 bg-muted hidden sm:inline-flex"
				>
					Mark & Next &rarr;
				</button>
			{/if}

			{#if questionIndex < totalQuestions - 1}
				<button
					type="button"
					onclick={onnext}
					class="neo-btn neo-btn-primary text-xs py-2 px-4"
				>
					Save & Next &rarr;
				</button>
			{:else}
				<button
					type="button"
					onclick={onnext}
					class="neo-btn neo-btn-primary text-xs py-2 px-4"
				>
					Review Last &rarr;
				</button>
			{/if}
		</div>
	</div>
</div>
