<script lang="ts">
import ExamModeMiniPreview from '$lib/components/settings/ExamModeMiniPreview.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

const MARKING_SCHEME_PRESETS = [
	{ name: 'JEE Advanced', pos: 4, neg: 1 },
	{ name: 'JEE Main', pos: 4, neg: 1 },
	{ name: 'NEET', pos: 4, neg: 1 },
	{ name: 'SAT / General', pos: 1, neg: 0 },
	{ name: 'University', pos: 3, neg: 0 },
	{ name: 'Strict Penalty', pos: 4, neg: 2 },
];
</script>

<div class="neo-box p-4 sm:p-6 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] space-y-6">
	<div class="border-b-2 border-border-color pb-3">
		<h2 class="font-sans text-lg font-extrabold uppercase tracking-tight">
			Exam Taking & Grading Experience
		</h2>
		<p class="font-mono text-xs text-text-muted">
			Configure test player layout, instant vs. masked feedback, and scoring rules
		</p>
	</div>

	<!-- Settings Controls Form -->
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		<!-- View Mode -->
		<div class="space-y-1.5">
			<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
				Exam View Layout
			</span>
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={() => app.settings.setExamViewMode('focus')}
					class="p-2 border-2 font-mono text-xs font-bold uppercase text-center {app.settings.examViewMode === 'focus'
						? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)]'
						: 'bg-surface hover:bg-muted border-border-color text-text-primary'}"
				>
					Single Focus
				</button>
				<button
					type="button"
					onclick={() => app.settings.setExamViewMode('paper')}
					class="p-2 border-2 font-mono text-xs font-bold uppercase text-center {app.settings.examViewMode === 'paper'
						? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)]'
						: 'bg-surface hover:bg-muted border-border-color text-text-primary'}"
				>
					Full Paper
				</button>
			</div>
		</div>

		<!-- Evaluation Mode -->
		<div class="space-y-1.5">
			<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
				Evaluation & Feedback
			</span>
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={() => app.settings.setEvaluationMode('exam')}
					class="p-2 border-2 font-mono text-xs font-bold uppercase text-center {app.settings.evaluationMode === 'exam'
						? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)]'
						: 'bg-surface hover:bg-muted border-border-color text-text-primary'}"
				>
					Exam Mode
				</button>
				<button
					type="button"
					onclick={() => app.settings.setEvaluationMode('study')}
					class="p-2 border-2 font-mono text-xs font-bold uppercase text-center {app.settings.evaluationMode === 'study'
						? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)]'
						: 'bg-surface hover:bg-muted border-border-color text-text-primary'}"
				>
					Study Mode
				</button>
			</div>
		</div>

		<!-- Positive / Negative Marks -->
		<div class="space-y-1.5">
			<label for="pos-marks" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
				Default Correct Marks
			</label>
			<input
				id="pos-marks"
				type="number"
				min="1"
				max="10"
				step="0.5"
				value={app.settings.defaultPositiveMarks}
				onchange={(e) => app.settings.setDefaultPositiveMarks(Number(e.currentTarget.value))}
				class="neo-input w-full text-xs font-mono py-2"
			/>
		</div>

		<div class="space-y-1.5">
			<label for="neg-marks" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
				Default Negative Penalty
			</label>
			<input
				id="neg-marks"
				type="number"
				min="0"
				max="5"
				step="0.25"
				value={app.settings.defaultNegativeMarks}
				onchange={(e) => app.settings.setDefaultNegativeMarks(Number(e.currentTarget.value))}
				class="neo-input w-full text-xs font-mono py-2"
			/>
		</div>

		<!-- Marking Scheme Presets -->
		<div class="space-y-1.5 sm:col-span-2 pt-1 border-t border-border-color/30">
			<span class="font-mono text-[10px] font-bold uppercase text-text-muted block">
				Marking Scheme Presets:
			</span>
			<div class="flex flex-wrap items-center gap-1.5">
				{#each MARKING_SCHEME_PRESETS as scheme}
					{@const isActive = app.settings.defaultPositiveMarks === scheme.pos && app.settings.defaultNegativeMarks === scheme.neg}
					<button
						type="button"
						onclick={() => app.settings.setDefaultMarks(scheme.pos, scheme.neg)}
						class="font-mono text-[10px] py-1 px-2 border border-border-color transition-colors cursor-pointer {isActive
							? 'bg-accent-contrast text-accent-contrast-text font-bold shadow-[1px_1px_0px_var(--shadow-color)]'
							: 'bg-surface hover:bg-muted text-text-secondary'}"
					>
						{scheme.name} (+{scheme.pos}/-{scheme.neg})
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Interactive Mini Preview Container -->
	<div class="pt-2">
		<ExamModeMiniPreview
			viewMode={app.settings.examViewMode}
			evaluationMode={app.settings.evaluationMode}
			positiveMarks={app.settings.defaultPositiveMarks}
			negativeMarks={app.settings.defaultNegativeMarks}
		/>
	</div>
</div>
