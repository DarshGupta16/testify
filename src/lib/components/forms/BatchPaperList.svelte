<script lang="ts">
export interface BatchFormEntry {
	id: string;
	title: string;
	autoTitle: boolean;
	testFile: {
		name: string;
		size: number;
		formattedSize: string;
		rawFile: File;
	};
	answerKeyFile: {
		name: string;
		size: number;
		formattedSize: string;
		rawFile: File;
	} | null;
}

const {
	items = [],
	onremoveitem,
	ontoggletitle,
	onselectkey,
	onremovekey,
}: {
	items: BatchFormEntry[];
	onremoveitem: (id: string) => void;
	ontoggletitle: (id: string, autoTitle: boolean) => void;
	onselectkey: (id: string, file: File) => void;
	onremovekey: (id: string) => void;
} = $props();
</script>

<div class="space-y-2.5 max-h-72 overflow-y-auto pr-1">
	{#each items as item, idx (item.id)}
		<div class="neo-box-sm p-3.5 bg-surface border-2 border-border-color space-y-3 animate-fade-in">
			<!-- Row Header: File Name & Remove -->
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2.5 min-w-0">
					<span class="flex h-5 w-5 shrink-0 items-center justify-center bg-accent-contrast text-accent-contrast-text font-mono text-[10px] font-bold">
						{idx + 1}
					</span>
					<div class="truncate">
						<p class="text-xs font-bold truncate text-text-primary">{item.testFile.name}</p>
						<p class="font-mono text-[10px] text-text-muted">{item.testFile.formattedSize}</p>
					</div>
				</div>
				<button
					type="button"
					onclick={() => onremoveitem(item.id)}
					class="neo-btn text-[10px] py-0.5 px-2 shrink-0 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
					title="Remove this document from batch"
				>
					✕ Remove
				</button>
			</div>

			<!-- Per-File Title Input -->
			<div class="space-y-1">
				<div class="flex items-center justify-between text-[11px]">
					<label for={`title_${item.id}`} class="font-mono font-bold uppercase text-text-muted">
						Paper Title
					</label>
					<label class="flex items-center gap-1.5 cursor-pointer select-none">
						<input
							type="checkbox"
							checked={item.autoTitle}
							onchange={(e) => ontoggletitle(item.id, e.currentTarget.checked)}
							class="accent-accent-contrast h-3 w-3"
						/>
						<span class="font-mono text-[10px] font-bold text-accent-contrast">
							✨ Auto-Detect
						</span>
					</label>
				</div>
				<input
					id={`title_${item.id}`}
					type="text"
					bind:value={item.title}
					disabled={item.autoTitle}
					placeholder={item.autoTitle ? 'Auto-detected from document header...' : 'e.g. Midterm Examination'}
					class={`neo-input w-full h-8 text-xs ${
						item.autoTitle ? 'bg-muted/40 italic text-text-muted border-dashed' : 'bg-surface'
					}`}
				/>
			</div>

			<!-- Optional Paired Answer Key -->
			<div class="pt-2 border-t border-border-color/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
				<span class="font-mono text-[10px] font-bold uppercase text-text-muted">
					Paired Answer Key:
				</span>
				{#if item.answerKeyFile}
					<div class="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/40 px-2 py-1">
						<span class="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 truncate max-w-[180px]">
							✓ {item.answerKeyFile.name}
						</span>
						<button
							type="button"
							onclick={() => onremovekey(item.id)}
							class="text-[10px] font-mono text-rose-500 hover:underline cursor-pointer"
							title="Remove answer key"
						>
							✕
						</button>
					</div>
				{:else}
					<label class="neo-btn text-[10px] py-1 px-2.5 cursor-pointer inline-flex items-center gap-1">
						<span>+ Attach Key PDF</span>
						<input
							type="file"
							accept=".pdf"
							class="hidden"
							onchange={(e) => {
								const file = (e.target as HTMLInputElement).files?.[0];
								if (file) onselectkey(item.id, file);
							}}
						/>
					</label>
				{/if}
			</div>
		</div>
	{/each}
</div>
