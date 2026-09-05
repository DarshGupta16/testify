<script lang="ts">
import type { PaperBlueprint } from '$lib/types/blueprint';
import BlueprintHeader from './blueprint/BlueprintHeader.svelte';
import BlueprintNav, { type BlueprintSection } from './blueprint/BlueprintNav.svelte';
import BlueprintArchetypesTab from './blueprint/tabs/BlueprintArchetypesTab.svelte';
import BlueprintOverviewTab from './blueprint/tabs/BlueprintOverviewTab.svelte';
import BlueprintPatternsTab from './blueprint/tabs/BlueprintPatternsTab.svelte';
import BlueprintRawTab from './blueprint/tabs/BlueprintRawTab.svelte';
import BlueprintStyleTab from './blueprint/tabs/BlueprintStyleTab.svelte';

let { blueprint, testTitle }: { blueprint: PaperBlueprint; testTitle?: string } = $props();

let activeSection = $state<BlueprintSection>('overview');

const archetypes = $derived(blueprint.question_archetypes || []);
const patterns = $derived(blueprint.surface_vs_deep_patterns || []);
</script>

<div class="flex flex-col h-full bg-surface font-sans text-text-primary">
	<!-- Blueprint Header -->
	<BlueprintHeader {blueprint} {testTitle} />

	<!-- Section Stepper Navigation with WAI-ARIA -->
	<BlueprintNav
		bind:activeSection
		archetypesCount={archetypes.length}
		patternsCount={patterns.length}
	/>

	<!-- Active Tabpanel Content Container -->
	<div
		role="tabpanel"
		id="panel-{activeSection}"
		aria-labelledby="tab-{activeSection}"
		tabindex="0"
		class="flex-1 overflow-y-auto p-3 sm:p-5 focus:outline-none"
	>
		{#if activeSection === 'overview'}
			<BlueprintOverviewTab {blueprint} />
		{:else if activeSection === 'archetypes'}
			<BlueprintArchetypesTab {blueprint} />
		{:else if activeSection === 'style'}
			<BlueprintStyleTab {blueprint} />
		{:else if activeSection === 'patterns'}
			<BlueprintPatternsTab {blueprint} />
		{:else if activeSection === 'raw'}
			<BlueprintRawTab {blueprint} />
		{/if}
	</div>
</div>
