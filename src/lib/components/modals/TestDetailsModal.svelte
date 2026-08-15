<script lang="ts">
import { goto } from '$app/navigation';
import ImageLightboxModal from '$lib/components/common/ImageLightboxModal.svelte';
import MathRenderer from '$lib/components/common/MathRenderer.svelte';
import type { ExtractedPdfPage } from '$lib/services/pdf';
import { getAppContext } from '$lib/stores/appContext.svelte';
import { formatBytes } from '$lib/utils';

const app = getAppContext();

let activeTab = $state<'questions' | 'diagrams' | 'pages'>('questions');
let zoomedImage = $state<{ title: string; src: string; info: string } | null>(null);

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

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === 'Escape' && !zoomedImage) {
		app.modals.closeDetails();
	}
}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if app.modals.isDetailsModalOpen && app.modals.selectedTest}
	{@const test = app.modals.selectedTest}
	{@const allDiagrams = test.extractedData?.pages.flatMap((p: ExtractedPdfPage) => p.embeddedImages) || []}
	{@const allPages = test.extractedData?.pages || []}

	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fade-in"
		onclick={(e) => {
			if (e.target === e.currentTarget && !zoomedImage) {
				app.modals.closeDetails();
			}
		}}
		role="presentation"
	>
		<!-- Modal Content -->
		<div
			class="neo-box-lg w-full max-w-4xl bg-surface p-6 sm:p-8 animate-slide-down max-h-[92vh] overflow-y-auto"
			role="dialog"
			aria-modal="true"
			aria-labelledby="details-modal-title"
		>
			<!-- Modal Header -->
			<div class="flex items-start justify-between border-b-2 border-border-color pb-4 mb-5">
				<div>
					<div class="flex flex-wrap items-center gap-2 mb-1.5">
						<span class="neo-badge bg-accent-contrast text-accent-contrast-text">
							{test.subject}
						</span>
						{#if test.hasAnswerKey}
							<span class="neo-badge bg-emerald-600 dark:bg-emerald-700 text-white">
								✓ Answer Key Active
							</span>
						{:else}
							<span class="neo-badge bg-muted text-text-muted">
								Self-Review Mode
							</span>
						{/if}
						{#if allDiagrams.length > 0}
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
					<h2 id="details-modal-title" class="text-xl sm:text-2xl font-black uppercase tracking-tight text-text-primary">
						{test.title}
					</h2>
				</div>

				<button
					type="button"
					onclick={() => app.modals.closeDetails()}
					class="neo-btn text-xs py-1 px-2.5"
					aria-label="Close details"
				>
					✕
				</button>
			</div>

			<!-- Specs Grid -->
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/40 border-2 border-border-color mb-6 font-mono text-xs">
				<div>
					<span class="text-[10px] text-text-muted uppercase block font-bold">Total Duration</span>
					<span class="text-base font-black text-text-primary">{test.durationMinutes ? `${test.durationMinutes} Mins` : 'Untimed'}</span>
				</div>
				<div>
					<span class="text-[10px] text-text-muted uppercase block font-bold">Questions</span>
					<span class="text-base font-black text-text-primary">{test.questionCount} Items</span>
				</div>
				<div>
					<span class="text-[10px] text-text-muted uppercase block font-bold">Total Marks</span>
					<span class="text-base font-black text-text-primary">{test.totalMarks} Points</span>
				</div>
				<div>
					<span class="text-[10px] text-text-muted uppercase block font-bold">PDF Source</span>
					<span class="text-xs font-bold text-text-primary truncate block" title={test.testFileName}>{test.testFileName}</span>
				</div>
			</div>

			<!-- Tab Navigation -->
			<div class="flex items-center gap-2 border-b-2 border-border-color mb-4 pb-2">
				<button
					type="button"
					onclick={() => (activeTab = 'questions')}
					class={`neo-btn text-xs py-1.5 px-3 font-mono font-bold ${activeTab === 'questions' ? 'neo-btn-primary' : 'bg-surface'}`}
				>
					Questions ({test.questions?.length || 0})
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'diagrams')}
					class={`neo-btn text-xs py-1.5 px-3 font-mono font-bold ${activeTab === 'diagrams' ? 'neo-btn-primary' : 'bg-surface'}`}
				>
					Extracted Diagrams ({allDiagrams.length})
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'pages')}
					class={`neo-btn text-xs py-1.5 px-3 font-mono font-bold ${activeTab === 'pages' ? 'neo-btn-primary' : 'bg-surface'}`}
				>
					Rendered Pages ({allPages.length})
				</button>
			</div>

			<!-- Tab 1: Questions Preview -->
			{#if activeTab === 'questions'}
				<div class="space-y-3 max-h-80 overflow-y-auto pr-1">
					{#if test.questions && test.questions.length > 0}
						{#each test.questions as q}
							<div class="neo-box-sm p-3.5 bg-surface text-sm space-y-2">
								<div class="flex items-center justify-between font-mono text-xs">
									<span class="font-bold text-text-primary">Question #{q.questionNumber}</span>
									<span class="text-[11px] text-text-muted uppercase font-bold">
										{#if q.type === 'multi_choice' || q.type === 'multiple_choice_multi'}
											[Multi-Choice (Multi-Correct)]
										{:else if q.type === 'single_choice' || q.type === 'multiple_choice'}
											[Single Choice]
										{:else}
											[Numerical]
										{/if}
										• {q.marks} Marks
									</span>
								</div>

								{#if q.associatedDiagramUrl}
									<div class="p-2 bg-muted/30 border border-border-color/60 inline-block">
										<button
											type="button"
											onclick={() =>
												(zoomedImage = {
													title: `Question #${q.questionNumber} - Associated Diagram`,
													src: q.associatedDiagramUrl!,
													info: `Linked figure ${q.associatedDiagramId || ''}`,
												})}
											class="cursor-pointer group flex flex-col items-start gap-1"
										>
											<img
												src={q.associatedDiagramUrl}
												alt={`Figure for question ${q.questionNumber}`}
												class="max-h-36 max-w-full object-contain border border-border-color/30 group-hover:scale-[1.02] transition-transform"
											/>
											<span class="font-mono text-[10px] text-accent-contrast underline">
												🔍 Click to enlarge diagram
											</span>
										</button>
									</div>
								{/if}

								<div class="text-xs text-text-secondary">
									<MathRenderer content={q.text} />
								</div>

								{#if q.options && q.options.length > 0}
									<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
										{#each q.options as opt, optIdx}
											{@const optText = typeof opt === 'string' ? opt : opt.text}
											<div class="p-2 bg-muted/60 border border-border-color/30 text-xs font-mono flex items-start gap-2">
												<span class="font-bold text-accent-contrast shrink-0">
													{String.fromCharCode(65 + optIdx)})
												</span>
												<div class="flex-1 overflow-x-auto">
													<MathRenderer content={optText} inline={true} />
												</div>
											</div>
										{/each}
									</div>
								{/if}

								{#if q.correctAnswer && test.hasAnswerKey}
									{@const matchingOpt = q.options?.find((o) => (typeof o === 'object' ? o.id === q.correctAnswer : o === q.correctAnswer))}
									<div class="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold pt-1 flex items-center gap-1.5 flex-wrap">
										<span>✓ Linked Solution:</span>
										{#if matchingOpt}
											{@const matchText = typeof matchingOpt === 'string' ? matchingOpt : matchingOpt.text}
											<span class="bg-emerald-500/10 px-1.5 py-0.5 border border-emerald-500/30">
												<MathRenderer content={matchText} inline={true} />
											</span>
										{:else}
											<span class="bg-emerald-500/10 px-1.5 py-0.5 border border-emerald-500/30">
												<MathRenderer content={q.correctAnswer} inline={true} />
											</span>
										{/if}
									</div>
								{/if}

								{#if q.explanation}
									<div class="p-2.5 bg-muted/40 border-l-2 border-accent-contrast text-[11px] font-mono mt-1 space-y-1">
										<span class="font-bold text-accent-contrast block">Explanation:</span>
										<MathRenderer content={q.explanation} />
									</div>
								{/if}
							</div>
						{/each}
					{:else}
						<div class="p-6 border-2 border-dashed border-border-color text-center font-mono text-xs text-text-muted">
							Questions will be rendered inside the interactive test session runner.
						</div>
					{/if}
				</div>
			{/if}

			<!-- Tab 2: Extracted Diagrams & Figures Gallery -->
			{#if activeTab === 'diagrams'}
				<div class="max-h-80 overflow-y-auto pr-1">
					{#if allDiagrams.length > 0}
						<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
							{#each allDiagrams as diag}
								<div
									class="neo-box-sm p-2 bg-surface flex flex-col justify-between group cursor-pointer hover:border-accent-contrast transition-colors"
									onclick={() =>
										(zoomedImage = {
											title: `Page ${diag.pageNumber} - Figure #${diag.imageIndex} (${diag.type === 'vector_diagram' ? 'Vector Diagram' : 'Raster Image'})`,
											src: diag.dataUrl,
											info: `${diag.width} × ${diag.height} px • ${formatBytes(diag.sizeBytes)}`,
										})}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && (zoomedImage = {
										title: `Page ${diag.pageNumber} - Figure #${diag.imageIndex}`,
										src: diag.dataUrl,
										info: `${diag.width} × ${diag.height} px • ${formatBytes(diag.sizeBytes)}`,
									})}
								>
									<div class="aspect-square bg-white border border-border-color/40 flex items-center justify-center p-1.5 overflow-hidden">
										<img
											src={diag.dataUrl}
											alt={`Diagram #${diag.imageIndex}`}
											class="max-h-full max-w-full object-contain"
											loading="lazy"
										/>
									</div>
									<div class="mt-2 font-mono text-[10px] space-y-0.5">
										<div class="flex items-center justify-between font-bold text-text-primary">
											<span>P.{diag.pageNumber} #{diag.imageIndex}</span>
											<span class={`uppercase text-[9px] px-1 py-0.2 border ${diag.type === 'vector_diagram' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'}`}>
												{diag.type === 'vector_diagram' ? 'Vector' : 'Raster'}
											</span>
										</div>
										<p class="text-text-muted truncate">{diag.width}×{diag.height} px</p>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="p-8 border-2 border-dashed border-border-color text-center font-mono text-xs text-text-muted space-y-1">
							<p class="font-bold text-text-primary">No Embedded Diagrams Detected</p>
							<p>This test document contains purely algebraic or textual content.</p>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Tab 3: Rendered Pages Preview -->
			{#if activeTab === 'pages'}
				<div class="max-h-80 overflow-y-auto pr-1">
					{#if allPages.length > 0}
						<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
							{#each allPages as pg}
								<div
									class="neo-box-sm p-2.5 bg-surface flex flex-col justify-between group cursor-pointer hover:border-accent-contrast transition-colors"
									onclick={() =>
										(zoomedImage = {
											title: `Page ${pg.pageNumber} of ${allPages.length}`,
											src: pg.rasterDataUrl,
											info: `${pg.rasterWidth} × ${pg.rasterHeight} px • ${formatBytes(pg.rasterSizeBytes)} • ${pg.embeddedImages.length} Diagrams`,
										})}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && (zoomedImage = {
										title: `Page ${pg.pageNumber} of ${allPages.length}`,
										src: pg.rasterDataUrl,
										info: `${pg.rasterWidth} × ${pg.rasterHeight} px`,
									})}
								>
									<div class="aspect-[3/4] bg-white border border-border-color/40 flex items-center justify-center p-1 overflow-hidden">
										<img
											src={pg.rasterDataUrl}
											alt={`Page ${pg.pageNumber}`}
											class="max-h-full max-w-full object-contain"
											loading="lazy"
										/>
									</div>
									<div class="mt-2 font-mono text-xs flex items-center justify-between">
										<span class="font-bold text-text-primary">Page {pg.pageNumber}</span>
										<span class="text-[10px] text-text-muted">{pg.embeddedImages.length} figures</span>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="p-8 border-2 border-dashed border-border-color text-center font-mono text-xs text-text-muted">
							Full page renders will be generated upon uploading a test PDF.
						</div>
					{/if}
				</div>
			{/if}

			<!-- Modal Footer Actions -->
			<div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 mt-4 border-t-2 border-border-color">
				<button
					type="button"
					onclick={() => app.handleDeleteTest(test.id)}
					class="neo-btn text-xs py-2 px-3 text-rose-500 hover:bg-rose-600 hover:text-white w-full sm:w-auto"
				>
					Delete Assessment
				</button>

				<div class="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
					<button
						type="button"
						onclick={() => app.modals.closeDetails()}
						class="neo-btn text-xs py-2 px-3 flex-1 sm:flex-none"
					>
						Close
					</button>
					<button
						type="button"
						onclick={handleStartPractice}
						class="neo-btn text-xs py-2 px-4 flex-1 sm:flex-none border-emerald-600 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
						title="Untimed practice mode with hints"
					>
						🌿 Practice Mode
					</button>
					<button
						type="button"
						onclick={handleStartExam}
						class="neo-btn neo-btn-primary text-xs py-2 px-4 flex-1 sm:flex-none"
						title="Strict timed exam simulation"
					>
						🎯 Exam Simulation &rarr;
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Shared Zoom Lightbox -->
<ImageLightboxModal
	image={zoomedImage}
	onclose={() => (zoomedImage = null)}
/>
