<script lang="ts">
import type { QuestionPreview } from '$lib/types/test';

interface Props {
	questions: QuestionPreview[];
	selectedIndex: number;
	onselect: (index: number) => void;
	onadd: () => void;
}

const { questions = [], selectedIndex = 0, onselect, onadd }: Props = $props();

function getTypeBadge(type: string): string {
	if (type === 'multi_choice' || type === 'multiple_choice_multi') return 'MC';
	if (type === 'numerical') return 'NUM';
	return 'SC';
}
</script>

<div class="neo-box p-3.5 bg-surface border-2 border-border-color space-y-3">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-border-color/30 pb-2">
		<h4 class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
			Questions ({questions.length})
		</h4>
		<button
			type="button"
			onclick={onadd}
			class="neo-btn text-[11px] py-1 px-2.5 bg-accent-contrast text-accent-contrast-text border-accent-contrast hover:opacity-90 font-bold"
		>
			+ Add Q
		</button>
	</div>

	<!-- Scrollable Question Pills / Tiles -->
	<div class="grid grid-cols-2 sm:grid-cols-1 gap-1.5 max-h-72 overflow-y-auto pr-1">
		{#each questions as q, idx (q.id || idx)}
			{@const isSelected = idx === selectedIndex}
			{@const typeBadge = getTypeBadge(q.type)}

			<button
				type="button"
				onclick={() => onselect(idx)}
				class={`w-full p-2 text-left font-mono text-xs border-2 flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
					isSelected
						? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)]'
						: 'bg-muted/40 hover:bg-muted border-border-color/40 text-text-primary'
				}`}
			>
				<div class="flex items-center gap-1.5 truncate">
					<span class="font-bold">Q{q.questionNumber || idx + 1}</span>
					<span
						class={`text-[9px] px-1 py-0.2 border uppercase font-bold ${
							isSelected
								? 'border-accent-contrast-text/40 bg-accent-contrast-text/10 text-accent-contrast-text'
								: 'border-border-color/30 bg-surface text-text-muted'
						}`}
					>
						{typeBadge}
					</span>
				</div>

				<span
					class={`text-[10px] font-bold shrink-0 ${
						isSelected ? 'text-accent-contrast-text' : 'text-emerald-600 dark:text-emerald-400'
					}`}
				>
					+{q.marks}
				</span>
			</button>
		{/each}
	</div>
</div>
