<script lang="ts">
import { v4 as uuidv4 } from 'uuid';
import MathRenderer from '$lib/components/common/MathRenderer.svelte';
import type { QuestionOption } from '$lib/types/test';

interface Props {
	options: QuestionOption[];
	isMulti: boolean;
	correctAnswer?: string;
	correctAnswers?: string[];
	onupdateoptions: (options: QuestionOption[]) => void;
	onselectcorrectsingle: (optId: string) => void;
	ontogglecorrectmulti: (optId: string) => void;
}

const {
	options = [],
	isMulti = false,
	correctAnswer = '',
	correctAnswers = [],
	onupdateoptions,
	onselectcorrectsingle,
	ontogglecorrectmulti,
}: Props = $props();

let previewingOptId = $state<string | null>(null);

function handleOptionTextChange(index: number, newText: string) {
	const next = options.map((opt, i) => (i === index ? { ...opt, text: newText } : opt));
	onupdateoptions(next);
}

function handleAddOption() {
	const newOpt: QuestionOption = {
		id: `opt_${uuidv4().slice(0, 8)}`,
		text: `Option ${String.fromCharCode(65 + options.length)}`,
	};
	onupdateoptions([...options, newOpt]);
}

function handleRemoveOption(index: number) {
	if (options.length <= 1) return;
	const removedOpt = options[index];
	const next = options.filter((_, i) => i !== index);
	onupdateoptions(next);

	// If removed option was selected, update correct answers
	if (!isMulti && correctAnswer === removedOpt.id && next[0]) {
		onselectcorrectsingle(next[0].id);
	}
}

function togglePreview(id: string) {
	previewingOptId = previewingOptId === id ? null : id;
}
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<div class="block font-mono text-xs font-bold uppercase text-text-secondary">
			<span>Options & Correct Answer ({options.length})</span>
			<span class="text-[10px] text-text-muted font-normal block">
				{isMulti ? 'Select checkboxes for all correct options' : 'Select radio for the correct option'}
			</span>
		</div>

		<button
			type="button"
			onclick={handleAddOption}
			class="neo-btn text-[11px] py-1 px-2.5 bg-muted hover:bg-surface border-border-color"
		>
			+ Add Option
		</button>
	</div>

	<div class="space-y-2.5">
		{#each options as opt, idx (opt.id || idx)}
			{@const letter = String.fromCharCode(65 + idx)}
			{@const isCorrect = isMulti
				? (correctAnswers || []).includes(opt.id)
				: correctAnswer === opt.id}
			{@const isPreviewing = previewingOptId === opt.id}

			<div
				class={`p-3 border-2 transition-all ${
					isCorrect
						? 'bg-emerald-500/10 border-emerald-500/70 dark:bg-emerald-950/20'
						: 'bg-muted/30 border-border-color/40'
				}`}
			>
				<div class="flex items-start gap-2.5">
					<!-- Correct Answer Selector -->
					<div class="pt-2">
						{#if isMulti}
							<label
								class="flex items-center justify-center h-6 w-6 cursor-pointer border-2 border-border-color bg-surface hover:bg-muted font-mono text-xs font-bold"
								title={isCorrect ? 'Marked as correct' : 'Click to mark as correct'}
							>
								<input
									type="checkbox"
									checked={isCorrect}
									onchange={() => ontogglecorrectmulti(opt.id)}
									class="sr-only"
								/>
								{#if isCorrect}
									<span class="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
								{:else}
									<span class="text-text-muted text-[10px]">{letter}</span>
								{/if}
							</label>
						{:else}
							<label
								class="flex items-center justify-center h-6 w-6 cursor-pointer border-2 border-border-color bg-surface hover:bg-muted font-mono text-xs font-bold rounded-full"
								title={isCorrect ? 'Marked as correct' : 'Click to mark as correct'}
							>
								<input
									type="radio"
									name="correct-option-group"
									checked={isCorrect}
									onchange={() => onselectcorrectsingle(opt.id)}
									class="sr-only"
								/>
								{#if isCorrect}
									<span class="h-2.5 w-2.5 bg-emerald-600 dark:text-emerald-400 rounded-full"></span>
								{:else}
									<span class="text-text-muted text-[10px]">{letter}</span>
								{/if}
							</label>
						{/if}
					</div>

					<!-- Option Text Editor / Preview -->
					<div class="flex-1 space-y-1.5 min-w-0">
						<div class="flex items-center justify-between gap-2">
							<span class="font-mono text-xs font-bold text-text-primary">
								Option {letter}
								{#if isCorrect}
									<span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase ml-1.5">
										(Correct)
									</span>
								{/if}
							</span>

							<div class="flex items-center gap-1">
								<button
									type="button"
									onclick={() => togglePreview(opt.id)}
									class="font-mono text-[10px] px-1.5 py-0.5 border border-border-color/40 bg-surface hover:bg-muted text-text-muted hover:text-text-primary uppercase"
								>
									{isPreviewing ? 'Edit' : 'Preview'}
								</button>
								{#if options.length > 1}
									<button
										type="button"
										onclick={() => handleRemoveOption(idx)}
										class="font-mono text-[10px] px-1.5 py-0.5 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/40"
										title="Delete option"
									>
										✕
									</button>
								{/if}
							</div>
						</div>

						{#if isPreviewing}
							<div class="p-2 bg-surface border border-border-color/30 text-xs font-mono min-h-[38px] flex items-center">
								<MathRenderer content={opt.text} inline={true} />
							</div>
						{:else}
							<input
								type="text"
								value={opt.text}
								oninput={(e) => handleOptionTextChange(idx, e.currentTarget.value)}
								placeholder="Enter option content (Markdown & LaTeX supported)..."
								class="neo-input w-full text-xs font-mono py-1.5 px-2.5"
							/>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
