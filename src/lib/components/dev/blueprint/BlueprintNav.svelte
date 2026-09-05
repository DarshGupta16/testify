<script lang="ts">
export type BlueprintSection = 'overview' | 'archetypes' | 'style' | 'patterns' | 'raw';

let {
	activeSection = $bindable('overview'),
	archetypesCount = 0,
	patternsCount = 0
}: {
	activeSection: BlueprintSection;
	archetypesCount?: number;
	patternsCount?: number;
} = $props();

const tabs: { id: BlueprintSection; label: string }[] = $derived([
	{ id: 'overview', label: '1. Overview & Philosophy' },
	{ id: 'archetypes', label: `2. Question Archetypes (${archetypesCount})` },
	{ id: 'style', label: '3. Writing Style & Distractors' },
	{ id: 'patterns', label: `4. Surface vs Deep Patterns (${patternsCount})` },
	{ id: 'raw', label: '5. Raw JSON' }
]);

function handleKeyDown(event: KeyboardEvent, currentIndex: number) {
	if (event.key === 'ArrowRight') {
		event.preventDefault();
		const nextIndex = (currentIndex + 1) % tabs.length;
		activeSection = tabs[nextIndex].id;
		document.getElementById(`tab-${tabs[nextIndex].id}`)?.focus();
	} else if (event.key === 'ArrowLeft') {
		event.preventDefault();
		const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
		activeSection = tabs[prevIndex].id;
		document.getElementById(`tab-${tabs[prevIndex].id}`)?.focus();
	} else if (event.key === 'Home') {
		event.preventDefault();
		activeSection = tabs[0].id;
		document.getElementById(`tab-${tabs[0].id}`)?.focus();
	} else if (event.key === 'End') {
		event.preventDefault();
		activeSection = tabs[tabs.length - 1].id;
		document.getElementById(`tab-${tabs[tabs.length - 1].id}`)?.focus();
	}
}
</script>

<div
	role="tablist"
	aria-label="Blueprint Sections"
	class="border-b-2 border-border-color bg-surface px-3 pt-2 shrink-0 overflow-x-auto no-scrollbar whitespace-nowrap flex items-center gap-1.5 font-mono text-xs font-bold"
>
	{#each tabs as tab, idx}
		<button
			type="button"
			role="tab"
			id="tab-{tab.id}"
			aria-controls="panel-{tab.id}"
			aria-selected={activeSection === tab.id}
			tabindex={activeSection === tab.id ? 0 : -1}
			onclick={() => (activeSection = tab.id)}
			onkeydown={(e) => handleKeyDown(e, idx)}
			class={`neo-btn text-xs py-2 px-3 border-b-0 shrink-0 cursor-pointer ${
				activeSection === tab.id ? 'neo-btn-primary' : 'bg-surface hover:bg-muted'
			}`}
		>
			{tab.label}
		</button>
	{/each}
</div>
