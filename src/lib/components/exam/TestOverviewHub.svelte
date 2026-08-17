<script lang="ts">
import ImageLightboxModal from '$lib/components/common/ImageLightboxModal.svelte';
import DiagramsTab from '$lib/components/exam/tabs/DiagramsTab.svelte';
import PagesTab from '$lib/components/exam/tabs/PagesTab.svelte';
import QuestionsTab from '$lib/components/exam/tabs/QuestionsTab.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { TestAttemptStats } from '$lib/stores/attemptStore.svelte';
import type { ExtractedEmbeddedImage, ExtractedPdfPage } from '$lib/types/pdf';
import type { TestAttempt, TestItem } from '$lib/types/test';
import { formatDate, formatSecondsToText } from '$lib/utils';

const app = getAppContext();

const {
	test,
	attempts = [],
	stats = null,
	onstartpractice,
	onstartexam,
	onopenedit,
	onviewattempt,
	ondeleteattempt,
	ondeletetest,
}: {
	test: TestItem;
	attempts: TestAttempt[];
	stats: TestAttemptStats | null;
	onstartpractice: () => void;
	onstartexam: () => void;
	onopenedit: () => void;
	onviewattempt: (attempt: TestAttempt) => void;
	ondeleteattempt: (id: string) => void;
	ondeletetest: () => void;
} = $props();

let activeTab = $state<'attempts' | 'questions' | 'diagrams' | 'pages'>('attempts');
let attemptFilter = $state<'all' | 'exam' | 'practice'>('all');
let isConfirmingDelete = $state(false);
let zoomedImage = $state<{ title: string; src: string; info?: string } | null>(null);

const allDiagrams = $derived<ExtractedEmbeddedImage[]>(
	test.extractedData?.pages.flatMap((p: ExtractedPdfPage) => p.embeddedImages) || []
);
const allPages = $derived<ExtractedPdfPage[]>(test.extractedData?.pages || []);

const filteredAttempts = $derived(
	attempts.filter((a) => attemptFilter === 'all' || a.mode === attemptFilter)
);
</script>

<div class="space-y-6 animate-fade-in pb-12">
	<!-- Hero Overview Banner -->
	<div class="neo-box-lg p-6 sm:p-8 bg-surface space-y-6">
		<!-- Top Action Row -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-border-color pb-5">
			<div>
				<div class="flex flex-wrap items-center gap-2 mb-2">
					<a href="/" class="font-mono text-xs text-text-muted hover:text-text-primary mr-2">
						&larr; Dashboard
					</a>
					<span class="neo-badge bg-accent-contrast text-accent-contrast-text">
						{app.subjects.getName(test.subjectId) || '?'}
					</span>
					{#if allDiagrams.length > 0}
						<span class="neo-badge bg-amber-500/20 text-amber-600 dark:text-amber-400">
							🎨 {allDiagrams.length} {allDiagrams.length === 1 ? 'Figure' : 'Figures'}
						</span>
					{/if}
					{#if test.aiModel}
						<span class="neo-badge bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/40">
							⚡ {test.aiModel}
						</span>
					{/if}
				</div>

				<h1 class="text-2xl sm:text-4xl font-black uppercase tracking-tight text-text-primary">
					{test.title}
				</h1>
			</div>

			<!-- Start Actions & Delete CTA -->
			<div class="flex flex-wrap items-center gap-2 sm:gap-3">
				<button
					type="button"
					onclick={onstartpractice}
					class="neo-btn text-xs py-2.5 px-4 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
				>
					🌿 Practice Mode
				</button>

				<button
					type="button"
					onclick={onstartexam}
					class="neo-btn neo-btn-primary text-xs py-2.5 px-5"
				>
					🎯 Exam Simulation
				</button>

				<button
					type="button"
					onclick={onopenedit}
					class="neo-btn text-xs py-2.5 px-3.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/20 font-bold"
					title="Edit Assessment & Questions"
				>
					✏️ Edit Test
				</button>

				{#if isConfirmingDelete}
					<div class="flex items-center gap-1">
						<button
							type="button"
							onclick={ondeletetest}
							class="neo-btn neo-btn-danger text-xs py-2.5 px-3"
						>
							Confirm Delete
						</button>
						<button
							type="button"
							onclick={() => (isConfirmingDelete = false)}
							class="neo-btn text-xs py-2.5 px-2.5"
						>
							✕
						</button>
					</div>
				{:else}
					<button
						type="button"
						onclick={() => (isConfirmingDelete = true)}
						class="neo-btn text-xs py-2.5 px-3 text-rose-500 hover:bg-rose-600 hover:text-white"
						title="Delete Assessment"
					>
						🗑️
					</button>
				{/if}
			</div>
		</div>

		{#if test.description}
			<p class="text-sm text-text-secondary">
				{test.description}
			</p>
		{/if}

		<!-- Specs Grid -->
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
			<div class="border-2 border-border-color bg-muted/40 p-3.5">
				<span class="text-[10px] text-text-muted uppercase font-bold block">Duration</span>
				<span class="text-lg font-black text-text-primary">
					{test.durationMinutes ? `${test.durationMinutes} Mins` : 'Untimed'}
				</span>
			</div>
			<div class="border-2 border-border-color bg-muted/40 p-3.5">
				<span class="text-[10px] text-text-muted uppercase font-bold block">Total Items</span>
				<span class="text-lg font-black text-text-primary">{test.questionCount} Questions</span>
			</div>
			<div class="border-2 border-border-color bg-muted/40 p-3.5">
				<span class="text-[10px] text-text-muted uppercase font-bold block">Total Marks</span>
				<span class="text-lg font-black text-text-primary">{test.totalMarks} Points</span>
			</div>
			<div class="border-2 border-border-color bg-muted/40 p-3.5">
				<span class="text-[10px] text-text-muted uppercase font-bold block">PDF Source</span>
				<span class="text-xs font-bold text-text-primary truncate block" title={test.testFileName}>
					{test.testFileName}
				</span>
			</div>
		</div>

		<!-- Performance Stats Card if Attempts exist -->
		{#if stats && stats.attemptCount > 0}
			<div class="p-4 bg-muted/30 border-2 border-border-color font-mono text-xs space-y-2">
				<span class="font-bold uppercase text-text-primary block text-[11px]">
					📊 Historical Attempt Analytics ({stats.attemptCount} Total Sessions)
				</span>
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
					<div>
						<span class="text-[10px] text-text-muted uppercase block">Best Score</span>
						<span class="font-black text-base text-emerald-600 dark:text-emerald-400">
							{stats.bestScore} / {stats.maxPossibleScore} ({stats.bestPercentage}%)
						</span>
					</div>
					<div>
						<span class="text-[10px] text-text-muted uppercase block">Average Score</span>
						<span class="font-black text-base text-text-primary">
							{stats.avgScore} ({stats.avgPercentage}%)
						</span>
					</div>
					<div>
						<span class="text-[10px] text-text-muted uppercase block">Exam / Practice</span>
						<span class="font-bold text-text-secondary">
							{stats.examAttemptCount} Exams • {stats.practiceAttemptCount} Practice
						</span>
					</div>
					<div>
						<span class="text-[10px] text-text-muted uppercase block">Last Attempt</span>
						<span class="font-bold text-text-secondary">
							{stats.lastAttemptAt ? formatDate(stats.lastAttemptAt) : 'Never'}
						</span>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Main Tab Navigation -->
	<div class="flex items-center gap-2 border-b-2 border-border-color pb-2 font-mono text-xs font-bold">
		<button
			type="button"
			onclick={() => (activeTab = 'attempts')}
			class={`neo-btn text-xs py-2 px-4 ${activeTab === 'attempts' ? 'neo-btn-primary' : 'bg-surface'}`}
		>
			Attempt History ({attempts.length})
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'questions')}
			class={`neo-btn text-xs py-2 px-4 ${activeTab === 'questions' ? 'neo-btn-primary' : 'bg-surface'}`}
		>
			Questions Preview ({test.questions?.length || 0})
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'diagrams')}
			class={`neo-btn text-xs py-2 px-4 ${activeTab === 'diagrams' ? 'neo-btn-primary' : 'bg-surface'}`}
		>
			Isolated Figures ({allDiagrams.length})
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'pages')}
			class={`neo-btn text-xs py-2 px-4 ${activeTab === 'pages' ? 'neo-btn-primary' : 'bg-surface'}`}
		>
			Rendered Pages ({allPages.length})
		</button>
	</div>

	<!-- Tab Panels -->
	<div>
		{#if activeTab === 'attempts'}
			<!-- Attempts Table -->
			<div class="neo-box p-5 sm:p-6 bg-surface space-y-4">
				<div class="flex flex-wrap items-center justify-between gap-3 border-b border-border-color/30 pb-3">
					<h3 class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
						Past Attempt Sessions
					</h3>
					<div class="flex items-center gap-1.5 font-mono text-xs">
						<button
							type="button"
							onclick={() => (attemptFilter = 'all')}
							class={`neo-badge cursor-pointer ${attemptFilter === 'all' ? 'bg-accent-contrast text-accent-contrast-text' : 'bg-muted'}`}
						>
							All ({attempts.length})
						</button>
						<button
							type="button"
							onclick={() => (attemptFilter = 'exam')}
							class={`neo-badge cursor-pointer ${attemptFilter === 'exam' ? 'bg-accent-contrast text-accent-contrast-text' : 'bg-muted'}`}
						>
							Exam ({attempts.filter((a) => a.mode === 'exam').length})
						</button>
						<button
							type="button"
							onclick={() => (attemptFilter = 'practice')}
							class={`neo-badge cursor-pointer ${attemptFilter === 'practice' ? 'bg-accent-contrast text-accent-contrast-text' : 'bg-muted'}`}
						>
							Practice ({attempts.filter((a) => a.mode === 'practice').length})
						</button>
					</div>
				</div>

				{#if filteredAttempts.length === 0}
					<div class="p-8 text-center bg-muted/30 border-2 border-dashed border-border-color/60 space-y-3">
						<p class="font-mono text-xs text-text-muted uppercase">No attempt sessions recorded yet.</p>
						<button
							type="button"
							onclick={onstartexam}
							class="neo-btn neo-btn-primary text-xs py-2 px-4"
						>
							Start First Exam Simulation &rarr;
						</button>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-left font-mono text-xs border-collapse">
							<thead>
								<tr class="border-b-2 border-border-color bg-muted/50 text-[11px] uppercase text-text-muted">
									<th class="py-2.5 px-3">Date</th>
									<th class="py-2.5 px-3">Mode</th>
									<th class="py-2.5 px-3">Score</th>
									<th class="py-2.5 px-3">Percentage</th>
									<th class="py-2.5 px-3">Accuracy</th>
									<th class="py-2.5 px-3">Time</th>
									<th class="py-2.5 px-3 text-right">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border-color/20">
								{#each filteredAttempts as att (att.id)}
									<tr class="hover:bg-muted/30 transition-colors">
										<td class="py-3 px-3 font-medium text-text-primary">
											{formatDate(att.completedAt || att.startedAt)}
										</td>
										<td class="py-3 px-3">
											{#if att.mode === 'practice'}
												<span class="neo-badge bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
													Practice
												</span>
											{:else}
												<span class="neo-badge bg-accent-contrast/15 text-accent-contrast text-[10px]">
													Exam
												</span>
											{/if}
										</td>
										<td class="py-3 px-3 font-bold text-text-primary">
											{att.score} / {att.maxPossibleScore}
										</td>
										<td class="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">
											{att.maxPossibleScore > 0 ? Math.round((Math.max(0, att.score) / att.maxPossibleScore) * 100) : 0}%
										</td>
										<td class="py-3 px-3 text-text-secondary">
											{att.accuracyPercentage}% ({att.correctCount}/{att.answeredCount})
										</td>
										<td class="py-3 px-3 text-text-muted">
											{formatSecondsToText(att.durationSecondsTaken)}
										</td>
										<td class="py-3 px-3 text-right space-x-1.5">
											<button
												type="button"
												onclick={() => onviewattempt(att)}
												class="neo-btn text-[10px] py-1 px-2.5"
											>
												View Scorecard
											</button>
											<button
												type="button"
												onclick={() => ondeleteattempt(att.id)}
												class="neo-btn text-[10px] py-1 px-2 text-rose-500 hover:bg-rose-600 hover:text-white"
												title="Delete Attempt"
											>
												🗑️
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

		{:else if activeTab === 'questions'}
			<QuestionsTab
				questions={test.questions || []}
				onzoom={(z) => (zoomedImage = z)}
			/>

		{:else if activeTab === 'diagrams'}
			<DiagramsTab
				diagrams={allDiagrams}
				testTitle={test.title}
				onzoom={(z) => (zoomedImage = z)}
			/>

		{:else if activeTab === 'pages'}
			<PagesTab
				pages={allPages}
				testFileName={test.testFileName}
				onzoom={(z) => (zoomedImage = z)}
			/>
		{/if}
	</div>

	<!-- Image Lightbox Modal for Enlarge View -->
	<ImageLightboxModal
		image={zoomedImage}
		onclose={() => (zoomedImage = null)}
	/>
</div>
