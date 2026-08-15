<script lang="ts">
import { formatBytes } from '$lib/utils';

interface SelectedFileInfo {
	name: string;
	size: number;
	formattedSize: string;
}

const {
	id,
	label,
	file = null,
	required = false,
	optionalBadge = false,
	disabled = false,
	badgeText = 'PDF',
	badgeColor = 'bg-accent-contrast text-accent-contrast-text',
	subtitle = 'Exam sheets, practice tests (.pdf)',
	onchange,
	onclear,
}: {
	id: string;
	label: string;
	file: SelectedFileInfo | null;
	required?: boolean;
	optionalBadge?: boolean;
	disabled?: boolean;
	badgeText?: string;
	badgeColor?: string;
	subtitle?: string;
	onchange: (file: File) => void;
	onclear: () => void;
} = $props();

let inputRef = $state<HTMLInputElement | null>(null);

function handleFileChange(event: Event) {
	const input = event.target as HTMLInputElement;
	if (input.files?.[0]) {
		onchange(input.files[0]);
	}
}

function handleClearClick() {
	if (inputRef) inputRef.value = '';
	onclear();
}
</script>

<div class="flex flex-col">
	<div class="flex items-center justify-between mb-1.5">
		<label for={id} class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
			{label} {#if required}<span class="text-rose-500">*</span>{/if}
		</label>
		{#if optionalBadge}
			<span class="font-mono text-[10px] uppercase text-text-muted bg-muted px-1.5 py-0.5 border border-border-color/40">
				Optional
			</span>
		{/if}
	</div>

	<input
		{id}
		type="file"
		accept=".pdf"
		bind:this={inputRef}
		onchange={handleFileChange}
		{disabled}
		class="hidden"
	/>

	{#if file}
		<div class="neo-box-sm p-3.5 flex items-center justify-between bg-muted/40">
			<div class="flex items-center gap-3 truncate pr-2">
				<div class={`flex h-8 w-8 shrink-0 items-center justify-center border-2 border-border-color font-mono text-xs font-bold ${badgeColor}`}>
					{badgeText}
				</div>
				<div class="truncate">
					<p class="text-xs font-bold truncate text-text-primary">{file.name}</p>
					<p class="font-mono text-[10px] text-text-muted">{file.formattedSize}</p>
				</div>
			</div>
			<button
				type="button"
				onclick={handleClearClick}
				{disabled}
				class="neo-btn text-[10px] py-1 px-2 shrink-0 disabled:opacity-40"
				title="Remove file"
			>
				Clear
			</button>
		</div>
	{:else}
		<button
			type="button"
			onclick={() => inputRef?.click()}
			{disabled}
			class="w-full flex flex-col items-center justify-center border-2 border-dashed border-border-color p-5 text-center bg-surface hover:bg-muted/30 transition-colors cursor-pointer group disabled:opacity-50"
		>
			<div class="mb-2 flex h-9 w-9 items-center justify-center border-2 border-border-color bg-surface group-hover:translate-x-0.5 group-hover:translate-y-0.5 transition-transform">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="square"
					class="h-4 w-4"
				>
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
					<polyline points="14 2 14 8 20 8" />
					<line x1="9" y1="15" x2="15" y2="15" />
				</svg>
			</div>
			<span class="text-xs font-bold uppercase tracking-wider text-text-primary">
				Select {label}
			</span>
			<span class="font-mono text-[10px] text-text-muted mt-0.5">
				{subtitle}
			</span>
		</button>
	{/if}
</div>
