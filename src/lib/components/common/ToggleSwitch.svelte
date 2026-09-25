<script lang="ts">
interface Props {
	checked?: boolean;
	disabled?: boolean;
	id?: string;
	name?: string;
	ariaLabel?: string;
	onchange?: (checked: boolean) => void;
	class?: string;
}

let {
	checked = $bindable(false),
	disabled = false,
	id,
	name,
	ariaLabel,
	onchange,
	class: className = '',
}: Props = $props();

function handleChange(e: Event) {
	const target = e.currentTarget as HTMLInputElement;
	checked = target.checked;
	onchange?.(target.checked);
}
</script>

<label
	class="relative inline-flex items-center select-none {disabled
		? 'cursor-not-allowed opacity-40'
		: 'cursor-pointer'} {className}"
>
	<input
		type="checkbox"
		role="switch"
		{id}
		{name}
		aria-label={ariaLabel}
		aria-checked={checked}
		{disabled}
		checked={checked}
		onchange={handleChange}
		class="sr-only peer"
	/>
	<div
		class="w-9 h-5 bg-muted border-2 border-border-color transition-colors shadow-[1px_1px_0px_var(--shadow-color)] peer-checked:bg-accent-contrast peer-focus-visible:ring-2 peer-focus-visible:ring-accent-contrast peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface"
	></div>
	<div
		class="absolute left-0.5 top-0.5 bg-surface border-2 border-border-color w-4 h-4 transition-transform peer-checked:translate-x-4 shadow-[0.5px_0.5px_0px_var(--shadow-color)]"
	></div>
</label>
