<script lang="ts">
import { dev } from '$app/environment';
import { goto } from '$app/navigation';
import ImageLightboxModal from '$lib/components/common/ImageLightboxModal.svelte';
import DevPipelineTraceViewer from '$lib/components/dev/DevPipelineTraceViewer.svelte';
import DiagramsTab from '$lib/components/exam/tabs/DiagramsTab.svelte';
import PagesTab from '$lib/components/exam/tabs/PagesTab.svelte';
import QuestionsTab from '$lib/components/exam/tabs/QuestionsTab.svelte';
import { db } from '$lib/services/db';
import { getAppContext } from '$lib/stores/appContext.svelte';
import type { DevPipelineTrace } from '$lib/types/devTrace';

const app = getAppContext();

let activeTab = $state<'questions' | 'diagrams' | 'pages' | 'trace'>('questions');
let zoomedImage = $state<{ title: string; src: string; info?: string } | null>(null);
let loadedTrace = $state<DevPipelineTrace | null>(null);

$effect(() => {
	if (dev && app.modals.isDetailsModalOpen && app.modals.selectedTest) {
		const currentTest = app.modals.selectedTest;
		if (currentTest.devPipelineTrace) {
			loadedTrace = currentTest.devPipelineTrace;
		} else {
			db.getDevTrace(currentTest.id).then((t) => {
				loadedTrace = t || null;
			});
		}
	}
});

function handleStartPractice() {
	if (app.modals.selectedTest) {
		const testId = app.modals.selectedTest.id;
		app.modals.closeDetails();
		goto(`/test/${testId}?start=true&mode=practice`);
	}
}

function handleStartExam() {
	if (app.modals.selectedTest) {
		const testId = app.modals.selectedTest.id;
		app.modals.closeDetails();
		goto(`/test/${testId}?start=true&mode=exam`);
	}
}

function handleEdit() {
	if (app.modals.selectedTest) {
		const testId = app.modals.selectedTest.id;
		app.modals.closeDetails();
		goto(`/test/${testId}?edit=true`);
	}
}

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === 'Escape' && !zoomedImage) {
		app.modals.closeDetails();
	}
}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if app.modals.isDetailsModalOpen && app.modals.selectedTest}
	{@const test = app.modals.selectedTest}
	{@const allDiagrams = test.extractedData?.pages.flatMap((p) => p.embeddedImages) || []}
	{@const allPages = test.extractedData?.pages || []}

	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-xs animate-fade-in"
		onclick={(e) => {
			if (e.target === e.currentTarget && !zoomedImage) {
				app.modals.closeDetails();
			}
		}}
		role="presentation"
	>
		<!-- Modal Content -->
		<div
			class="neo-box-lg w-full max-w-4xl bg-surface p-4 sm:p-7 animate-slide-down max-h-[94vh] flex flex-col overflow-hidden"
			role="dialog"
			aria-modal="true"
			aria-labelledby="details-modal-title"
		>
			<!-- Modal Header -->
			<div class="flex items-start justify-between border-b-2 border-border-color pb-3 sm:pb-4 mb-4 shrink-0">
				<div>
					<div class="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
						<span class="neo-badge bg-accent-contrast text-accent-contrast-text">
							{app.subjects.getName(test.subjectId) || '?'}
						</span>
						{#if dev && allDiagrams.length > 0}
							<span class="neo-badge bg-amber-500/20 text-amber-600 dark:text-amber-400">
								🎨 {allDiagrams.length} {allDiagrams.length === 1 ? 'Diagram' : 'Diagrams'}
							</span>
						{/if}
						{#if test.aiModel}
							<span class="neo-badge bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/40">
								⚡ {test.aiModel}
							</span>
						{/if}
					</div>
					<h2 id="details-modal-title" class="text-lg sm:text-2xl font-black uppercase tracking-tight text-text-primary break-words">
						{test.title}
					</h2>
				</div>

				<button
					type="button"
					onclick={() => app.modals.closeDetails()}
					class="neo-btn text-xs py-1 px-2.5 ml-2 shrink-0"
					aria-label="Close details"
				>
					✕
				</button>
			</div>

			<!-- Specs Grid -->
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-4 bg-muted/40 border-2 border-border-color mb-4 font-mono text-xs shrink-0">
				<div>
					<span class="text-[10px] text-text-muted uppercase block font-bold">Total Duration</span>
					<span class="text-sm sm:text-base font-black text-text-primary">{test.durationMinutes ? `${test.durationMinutes} Mins` : 'Untimed'}</span>
				</div>
				<div>
					<span class="text-[10px] text-text-muted uppercase block font-bold">Questions</span>
					<span class="text-sm sm:text-base font-black text-text-primary">{test.questions?.length || 0} Items</span>
				</div>
				<div>
					<span class="text-[10px] text-text-muted uppercase block font-bold">Total Marks</span>
					<span class="text-sm sm:text-base font-black text-text-primary">{test.totalMarks} Points</span>
				</div>
				<div>
					<span class="text-[10px] text-text-muted uppercase block font-bold">PDF Source</span>
					<span class="text-xs font-bold text-text-primary truncate block" title={test.testFileName}>{test.testFileName}</span>
				</div>
			</div>

			<!-- Tab Navigation (Dev Only) -->
			{#if dev}
				<div class="flex items-center gap-1.5 sm:gap-2 border-b-2 border-border-color mb-3 sm:mb-4 pb-2 overflow-x-auto no-scrollbar whitespace-nowrap shrink-0">
					<button
						type="button"
						onclick={() => (activeTab = 'questions')}
						class={`neo-btn text-xs py-1.5 px-2.5 sm:px-3.5 font-mono font-bold shrink-0 ${activeTab === 'questions' ? 'neo-btn-primary' : 'bg-surface'}`}
					>
						Questions ({test.questions?.length || 0})
					</button>
					<button
						type="button"
						onclick={() => (activeTab = 'diagrams')}
						class={`neo-btn text-xs py-1.5 px-2.5 sm:px-3.5 font-mono font-bold shrink-0 ${activeTab === 'diagrams' ? 'neo-btn-primary' : 'bg-surface'}`}
					>
						Extracted Diagrams ({allDiagrams.length})
					</button>
					<button
						type="button"
						onclick={() => (activeTab = 'pages')}
						class={`neo-btn text-xs py-1.5 px-2.5 sm:px-3.5 font-mono font-bold shrink-0 ${activeTab === 'pages' ? 'neo-btn-primary' : 'bg-surface'}`}
					>
						Rendered Pages ({allPages.length})
					</button>
					<button
						type="button"
						onclick={() => (activeTab = 'trace')}
						class={`neo-btn text-xs py-1.5 px-2.5 sm:px-3.5 font-mono font-bold shrink-0 ${activeTab === 'trace' ? 'neo-btn-primary' : 'bg-surface'}`}
					>
						⚡ Pipeline Trace
					</button>
				</div>
			{/if}

			<!-- Tab Contents -->
			<div class="flex-1 min-h-0 overflow-y-auto pr-1 mb-4">
				{#if !dev || activeTab === 'questions'}
					<QuestionsTab
						questions={test.questions || []}
						onzoom={(item) => (zoomedImage = item)}
					/>
				{:else if activeTab === 'diagrams'}
					<DiagramsTab
						diagrams={allDiagrams}
						testTitle={test.title}
						onzoom={(item) => (zoomedImage = item)}
					/>
				{:else if activeTab === 'pages'}
					<PagesTab
						pages={allPages}
						testFileName={test.testFileName}
						onzoom={(item) => (zoomedImage = item)}
					/>
				{:else if activeTab === 'trace'}
					{#if loadedTrace}
						<div class="border-2 border-border-color neo-box h-full min-h-[480px]">
							<DevPipelineTraceViewer trace={loadedTrace} />
						</div>
					{:else}
						<div class="p-8 text-center font-mono text-xs text-text-muted border-2 border-dashed border-border-color bg-muted/10">
							No dev pipeline trace found for this test. New tests created in dev mode will record complete pipeline traces.
						</div>
					{/if}
				{/if}
			</div>

			<!-- Footer Action Buttons -->
			<div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t-2 border-border-color shrink-0">
				<div class="grid grid-cols-2 sm:flex sm:items-center gap-2">
					<a
						href={`/test/${test.id}`}
						onclick={() => app.modals.closeDetails()}
						class="neo-btn text-xs py-2 px-3 sm:py-2.5 sm:px-4 font-bold text-center truncate"
					>
						Open Full Hub &rarr;
					</a>
					<button
						type="button"
						onclick={handleEdit}
						class="neo-btn text-xs py-2 px-3 sm:py-2.5 sm:px-3.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/20 font-bold truncate"
					>
						✏️ Edit Test
					</button>
				</div>

				<div class="grid grid-cols-2 sm:flex sm:items-center gap-2">
					<button
						type="button"
						onclick={handleStartPractice}
						class="neo-btn text-xs py-2 px-3 sm:py-2.5 sm:px-4 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold truncate"
					>
						🌿 Practice
					</button>

					<button
						type="button"
						onclick={handleStartExam}
						class="neo-btn neo-btn-primary text-xs py-2 px-3 sm:py-2.5 sm:px-5 font-bold truncate"
					>
						🎯 Exam Sim
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Image Lightbox Modal for Enlarge Views -->
	<ImageLightboxModal
		image={zoomedImage}
		onclose={() => (zoomedImage = null)}
	/>
{/if}
