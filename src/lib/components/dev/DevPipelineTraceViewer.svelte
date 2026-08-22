<script lang="ts">
import MathRenderer from '$lib/components/common/MathRenderer.svelte';
import type { DevPipelineTrace } from '$lib/types/devTrace';

let { trace }: { trace: DevPipelineTrace } = $props();

type StageTab = 'extraction' | 'prompt' | 'ai' | 'parser' | 'normalization';
let activeStage = $state<StageTab>('normalization');

let isCopied = $state(false);
let rawJsonExpanded = $state(false);
let selectedQuestionIndex = $state<number | null>(null);

function copyTraceJson() {
	try {
		navigator.clipboard.writeText(JSON.stringify(trace, null, 2));
		isCopied = true;
		setTimeout(() => (isCopied = false), 2000);
	} catch (err) {
		console.error('Failed to copy trace JSON:', err);
	}
}

function formatBytes(bytes: number): string {
	if (!bytes || bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}
</script>

<div class="flex flex-col h-full bg-surface font-sans text-text-primary">
	<!-- Trace Header & Metadata Banner -->
	<div class="border-b-2 border-border-color bg-muted/40 p-3 sm:p-4 shrink-0">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
			<div class="space-y-1 min-w-0">
				<div class="flex items-center gap-2 flex-wrap">
					<span class="neo-badge bg-accent-contrast text-accent-contrast-text font-mono font-bold text-xs uppercase">
						⚡ Dev Pipeline Trace
					</span>
					<span class="neo-badge bg-primary/20 text-primary-text font-mono font-bold text-xs uppercase">
						{trace.provider} : {trace.model}
					</span>
					<span class="neo-badge bg-muted text-text-secondary font-mono text-xs">
						⏱️ {trace.totalDurationMs} ms total
					</span>
				</div>
				<h2 class="text-base sm:text-lg font-black truncate text-text-primary" title={trace.testTitle}>
					{trace.testTitle}
				</h2>
			</div>

			<div class="flex items-center gap-2 shrink-0">
				<button
					type="button"
					onclick={copyTraceJson}
					class="neo-btn text-xs py-1.5 px-3 font-mono font-bold flex items-center gap-1.5 bg-surface hover:bg-muted"
				>
					{isCopied ? '✓ Copied JSON' : '📋 Copy Trace JSON'}
				</button>
			</div>
		</div>
	</div>

	<!-- Stage Stepper Navigation -->
	<div class="border-b-2 border-border-color bg-surface px-3 pt-2 shrink-0 overflow-x-auto no-scrollbar whitespace-nowrap flex items-center gap-1.5 font-mono text-xs font-bold">
		<button
			type="button"
			onclick={() => (activeStage = 'extraction')}
			class={`neo-btn text-xs py-2 px-3 border-b-0 shrink-0 ${activeStage === 'extraction' ? 'neo-btn-primary' : 'bg-surface hover:bg-muted'}`}
		>
			1. PDF Ingestion ({trace.stages.extraction.durationMs}ms)
		</button>
		<button
			type="button"
			onclick={() => (activeStage = 'prompt')}
			class={`neo-btn text-xs py-2 px-3 border-b-0 shrink-0 ${activeStage === 'prompt' ? 'neo-btn-primary' : 'bg-surface hover:bg-muted'}`}
		>
			2. Prompts & Catalog ({trace.stages.promptPayload.diagramAssetsCount} figures)
		</button>
		<button
			type="button"
			onclick={() => (activeStage = 'ai')}
			class={`neo-btn text-xs py-2 px-3 border-b-0 shrink-0 ${activeStage === 'ai' ? 'neo-btn-primary' : 'bg-surface hover:bg-muted'}`}
		>
			3. AI Execution ({trace.stages.aiResponse.durationMs}ms)
		</button>
		<button
			type="button"
			onclick={() => (activeStage = 'parser')}
			class={`neo-btn text-xs py-2 px-3 border-b-0 shrink-0 ${activeStage === 'parser' ? 'neo-btn-primary' : 'bg-surface hover:bg-muted'}`}
		>
			4. JSON & LaTeX
		</button>
		<button
			type="button"
			onclick={() => (activeStage = 'normalization')}
			class={`neo-btn text-xs py-2 px-3 border-b-0 shrink-0 ${activeStage === 'normalization' ? 'neo-btn-primary' : 'bg-surface hover:bg-muted'}`}
		>
			5. Diagram Resolution ({trace.stages.normalization.questionsCount} Qs)
		</button>
	</div>

	<!-- Stage Content Panels -->
	<div class="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-4">
		{#if activeStage === 'extraction'}
			<!-- Stage 1: Extraction & Diagram Isolation -->
			<div class="space-y-4">
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
					<div class="border-2 border-border-color bg-muted/40 p-3">
						<span class="text-[10px] text-text-muted uppercase font-bold block">Document Name</span>
						<span class="font-bold text-text-primary truncate block" title={trace.stages.extraction.fileName}>
							{trace.stages.extraction.fileName}
						</span>
					</div>
					<div class="border-2 border-border-color bg-muted/40 p-3">
						<span class="text-[10px] text-text-muted uppercase font-bold block">Total Pages</span>
						<span class="text-base font-black text-text-primary">{trace.stages.extraction.totalPages} Pages</span>
					</div>
					<div class="border-2 border-border-color bg-muted/40 p-3">
						<span class="text-[10px] text-text-muted uppercase font-bold block">Isolated Figures</span>
						<span class="text-base font-black text-text-primary">{trace.stages.extraction.totalDiagrams} Items</span>
					</div>
					<div class="border-2 border-border-color bg-muted/40 p-3">
						<span class="text-[10px] text-text-muted uppercase font-bold block">Extraction Time</span>
						<span class="text-base font-black text-emerald-600 dark:text-emerald-400">
							{trace.stages.extraction.durationMs} ms
						</span>
					</div>
				</div>

				<!-- Diagram Crops Gallery -->
				<div class="border-2 border-border-color bg-surface p-4 space-y-3">
					<div class="flex items-center justify-between">
						<h3 class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
							🖼️ Isolated Diagram Crops ({trace.stages.extraction.diagrams.length})
						</h3>
						<span class="text-xs font-mono text-text-muted">Sorted in top-to-bottom reading order</span>
					</div>

					{#if trace.stages.extraction.diagrams.length === 0}
						<div class="p-6 text-center text-text-muted font-mono text-xs border border-dashed border-border-color">
							No raster or vector diagrams detected in this PDF.
						</div>
					{:else}
						<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
							{#each trace.stages.extraction.diagrams as diag}
								<div class="border-2 border-border-color bg-muted/20 p-3 space-y-2 flex flex-col justify-between">
									<div class="flex items-center justify-between font-mono text-xs">
										<span class="neo-badge bg-primary/20 text-primary-text font-bold">
											{diag.id}
										</span>
										<span class="neo-badge bg-muted text-[10px]">
											Page {diag.pageNumber} • {diag.type === 'vector_diagram' ? 'Vector Path' : 'Raster Bitmap'}
										</span>
									</div>

									<div class="h-36 flex items-center justify-center bg-black/5 dark:bg-white/5 border border-border-color p-2 overflow-hidden">
										<img
											src={diag.dataUrl}
											alt={diag.id}
											class="max-h-full max-w-full object-contain rounded-xs"
										/>
									</div>

									<div class="grid grid-cols-2 gap-1 font-mono text-[10px] text-text-muted border-t border-border-color/30 pt-1.5">
										<div>Dim: {Math.round(diag.width)} × {Math.round(diag.height)}px</div>
										{#if diag.position}
											<div class="text-right">Pos: Y={Math.round(diag.position.y)}</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

		{:else if activeStage === 'prompt'}
			<!-- Stage 2: Prompts & Visual Catalog -->
			<div class="space-y-4 font-mono text-xs">
				<!-- Diagram Catalog List -->
				<div class="border-2 border-border-color bg-surface p-4 space-y-2">
					<h3 class="font-bold uppercase tracking-wider text-text-primary">
						📋 Diagram Catalog Provided to LLM ({trace.stages.promptPayload.diagramCatalog.length} Figures)
					</h3>
					{#if trace.stages.promptPayload.diagramCatalog.length === 0}
						<p class="text-text-muted">No diagram catalog was passed to the model.</p>
					{:else}
						<div class="flex flex-wrap gap-2 pt-1">
							{#each trace.stages.promptPayload.diagramCatalog as item}
								<span class="neo-badge bg-accent-contrast text-accent-contrast-text font-bold">
									"{item.id}" (Page {item.pageNumber})
								</span>
							{/each}
						</div>
					{/if}
				</div>

				<!-- User Prompt -->
				<div class="border-2 border-border-color bg-surface p-4 space-y-2">
					<h3 class="font-bold uppercase tracking-wider text-text-primary">
						💬 Synthesized User Prompt
					</h3>
					<pre class="p-3 bg-muted/40 border border-border-color overflow-x-auto text-[11px] whitespace-pre-wrap font-mono text-text-primary max-h-60 leading-relaxed">
{trace.stages.promptPayload.userPrompt}
					</pre>
				</div>

				<!-- System Prompt -->
				<div class="border-2 border-border-color bg-surface p-4 space-y-2">
					<h3 class="font-bold uppercase tracking-wider text-text-primary">
						⚙️ System Instructions
					</h3>
					<pre class="p-3 bg-muted/40 border border-border-color overflow-x-auto text-[11px] whitespace-pre-wrap font-mono text-text-primary max-h-60 leading-relaxed">
{trace.stages.promptPayload.systemPrompt}
					</pre>
				</div>
			</div>

		{:else if activeStage === 'ai'}
			<!-- Stage 3: AI Model Execution -->
			<div class="space-y-4 font-mono text-xs">
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
					<div class="border-2 border-border-color bg-muted/40 p-3">
						<span class="text-[10px] text-text-muted uppercase font-bold block">Latency</span>
						<span class="text-base font-black text-emerald-600 dark:text-emerald-400">
							{trace.stages.aiResponse.durationMs} ms
						</span>
					</div>
					<div class="border-2 border-border-color bg-muted/40 p-3">
						<span class="text-[10px] text-text-muted uppercase font-bold block">Prompt Tokens</span>
						<span class="text-base font-black text-text-primary">
							{trace.stages.aiResponse.tokenUsage?.promptTokens ?? 'N/A'}
						</span>
					</div>
					<div class="border-2 border-border-color bg-muted/40 p-3">
						<span class="text-[10px] text-text-muted uppercase font-bold block">Output Tokens</span>
						<span class="text-base font-black text-text-primary">
							{trace.stages.aiResponse.tokenUsage?.completionTokens ?? 'N/A'}
						</span>
					</div>
					<div class="border-2 border-border-color bg-muted/40 p-3">
						<span class="text-[10px] text-text-muted uppercase font-bold block">Total Tokens</span>
						<span class="text-base font-black text-text-primary">
							{trace.stages.aiResponse.tokenUsage?.totalTokens ?? 'N/A'}
						</span>
					</div>
				</div>

				<div class="border-2 border-border-color bg-surface p-4 space-y-2">
					<h3 class="font-bold uppercase tracking-wider text-text-primary">
						🤖 Raw LLM Model Output String
					</h3>
					<pre class="p-3 bg-muted/40 border border-border-color overflow-x-auto text-[11px] whitespace-pre-wrap font-mono text-text-primary max-h-96 leading-relaxed">
{trace.stages.aiResponse.rawResponseText}
					</pre>
				</div>
			</div>

		{:else if activeStage === 'parser'}
			<!-- Stage 4: JSON & LaTeX Sanitization -->
			<div class="space-y-4 font-mono text-xs">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div class="border-2 border-border-color bg-surface p-4 space-y-2">
						<h3 class="font-bold uppercase tracking-wider text-text-primary">
							🧹 Step 1: Cleaned JSON (Fences Stripped)
						</h3>
						<pre class="p-3 bg-muted/40 border border-border-color overflow-x-auto text-[11px] whitespace-pre-wrap font-mono text-text-primary max-h-80 leading-relaxed">
{trace.stages.parser.cleanedJsonText}
						</pre>
					</div>

					<div class="border-2 border-border-color bg-surface p-4 space-y-2">
						<h3 class="font-bold uppercase tracking-wider text-text-primary">
							🔬 Step 2: LaTeX Sanitized JSON
						</h3>
						<pre class="p-3 bg-muted/40 border border-border-color overflow-x-auto text-[11px] whitespace-pre-wrap font-mono text-text-primary max-h-80 leading-relaxed">
{trace.stages.parser.sanitizedJsonText}
						</pre>
					</div>
				</div>

				<div class="border-2 border-border-color bg-surface p-4 space-y-2">
					<h3 class="font-bold uppercase tracking-wider text-text-primary">
						📦 Step 3: Parsed Schema Object
					</h3>
					<pre class="p-3 bg-muted/40 border border-border-color overflow-x-auto text-[11px] whitespace-pre-wrap font-mono text-text-primary max-h-80 leading-relaxed">
{JSON.stringify(trace.stages.parser.parsedSchema, null, 2)}
					</pre>
				</div>
			</div>

		{:else if activeStage === 'normalization'}
			<!-- Stage 5: Diagram Resolution & Normalization Diagnostics -->
			<div class="space-y-4">
				<div class="flex items-center justify-between border-2 border-border-color bg-muted/40 p-3 font-mono text-xs">
					<span class="font-bold uppercase text-text-primary">
						🎯 Diagram Linking Diagnostics ({trace.stages.normalization.diagramResolutionLogs.length} Questions)
					</span>
					<span class="text-text-muted">
						Linked Figures: {trace.stages.normalization.diagramResolutionLogs.filter(d => d.resolvedId).length} / {trace.stages.normalization.diagramResolutionLogs.length}
					</span>
				</div>

				<div class="space-y-3">
					{#each trace.stages.normalization.diagramResolutionLogs as diagLog, idx}
						{@const question = trace.stages.normalization.finalQuestions[idx]}
						<div class="border-2 border-border-color bg-surface p-4 space-y-3">
							<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-color/30 pb-2">
								<div class="flex items-center gap-2 flex-wrap font-mono text-xs">
									<span class="neo-badge neo-btn-primary font-bold">
										Q{diagLog.questionNumber}
									</span>
									<span class="neo-badge bg-muted">
										Page {diagLog.questionPage ?? 'Unspecified'}
									</span>
									<span class="neo-badge bg-muted">
										Raw AI ID: {diagLog.rawId ? `"${diagLog.rawId}"` : 'null'}
									</span>
									{#if diagLog.mentionsFigure}
										<span class="neo-badge bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold">
											🔍 Visual Keyword Mentioned
										</span>
									{/if}
								</div>

								<div>
									{#if diagLog.resolvedId}
										<span class="neo-badge bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-mono font-bold text-xs">
											✓ {diagLog.matchedTier} ➔ {diagLog.resolvedId}
										</span>
									{:else}
										<span class="neo-badge bg-muted text-text-muted font-mono text-xs">
											✕ Unlinked (No Diagram)
										</span>
									{/if}
								</div>
							</div>

							<!-- Question & Diagram Side-by-Side -->
							<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div class="md:col-span-2 space-y-2">
									<div class="font-sans text-sm text-text-primary leading-relaxed font-medium">
										<MathRenderer content={question ? question.text : diagLog.questionTextSnippet} />
									</div>

									{#if question?.options && question.options.length > 0}
										<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
											{#each question.options as opt}
												{@const isCorrect = question.type === 'multi_choice' ? question.correctAnswers?.includes(opt.id) : question.correctAnswer === opt.id}
												<div class={`p-2 border font-mono text-xs flex items-center gap-2 ${isCorrect ? 'border-emerald-500 bg-emerald-500/10 font-bold text-emerald-900 dark:text-emerald-300' : 'border-border-color/40 bg-muted/20 text-text-secondary'}`}>
													<span class="neo-badge text-[10px]">{opt.id}</span>
													<span class="truncate"><MathRenderer content={opt.text} /></span>
												</div>
											{/each}
										</div>
									{:else if question?.type === 'numerical'}
										<div class="p-2 border border-emerald-500/40 bg-emerald-500/10 font-mono text-xs text-emerald-800 dark:text-emerald-300">
											Numerical Correct Answer: <strong>{question.correctAnswer}</strong>
										</div>
									{/if}
								</div>

								<!-- Linked Diagram Thumbnail -->
								<div class="flex flex-col items-center justify-center p-2 border border-border-color bg-muted/20 min-h-[120px]">
									{#if diagLog.resolvedUrl}
										<span class="text-[10px] font-mono text-text-muted mb-1 font-bold">
											Linked: {diagLog.resolvedId}
										</span>
										<img
											src={diagLog.resolvedUrl}
											alt={diagLog.resolvedId}
											class="max-h-28 max-w-full object-contain rounded-xs border border-border-color/30"
										/>
									{:else}
										<span class="text-xs font-mono text-text-muted italic">
											No Diagram Linked
										</span>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
