<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import { formatDuration } from '$lib/utils';

interface Props {
	folderId?: string | null;
}

let { folderId }: Props = $props();

const app = getAppContext();

const effectiveFolderId = $derived(folderId !== undefined ? folderId : app.folders.activeFolderId);
const isInsideFolder = $derived(Boolean(effectiveFolderId));

// Only aggregate over ready tests within the active folder (or all ready tests at root)
const contextTests = $derived.by(() => {
	if (!effectiveFolderId) {
		return app.tests.readyTests;
	}
	const folderTestIds = new Set(app.folders.getTestIdsInFolder(effectiveFolderId));
	return app.tests.readyTests.filter(
		(t) => folderTestIds.has(t.id) || t.folderId === effectiveFolderId
	);
});

const totalTests = $derived(contextTests.length);
const totalQuestions = $derived(
	contextTests.reduce((acc, curr) => acc + (curr.questions?.length || 0), 0)
);
const totalDurationMinutes = $derived(
	contextTests.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0)
);
</script>

<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
	<!-- Stat 1: Total Tests -->
	<div class="neo-box p-3.5 sm:p-5 flex flex-col justify-between">
		<div class="flex items-center justify-between text-text-muted mb-2">
			<span class="font-mono text-xs uppercase font-bold tracking-wider">
				{isInsideFolder ? 'Folder Tests' : 'Total Tests'}
			</span>
			<div class="h-2.5 w-2.5 bg-accent-contrast"></div>
		</div>
		<div class="flex items-baseline gap-2">
			<span class="font-sans text-2xl sm:text-4xl font-black text-text-primary">
				{totalTests}
			</span>
			<span class="font-mono text-xs text-text-muted font-bold">
				{totalTests === 1 ? 'Test' : 'Tests'}
			</span>
		</div>
		<span class="font-mono text-[10px] text-text-secondary mt-1">
			{isInsideFolder ? 'In this folder' : 'Ready for practice'}
		</span>
	</div>

	<!-- Stat 2: Total Questions -->
	<div class="neo-box p-3.5 sm:p-5 flex flex-col justify-between">
		<div class="flex items-center justify-between text-text-muted mb-2">
			<span class="font-mono text-xs uppercase font-bold tracking-wider">Total Questions</span>
			<div class="h-2.5 w-2.5 bg-accent-contrast"></div>
		</div>
		<div class="flex items-baseline gap-2">
			<span class="font-sans text-2xl sm:text-4xl font-black text-text-primary">
				{totalQuestions}
			</span>
			<span class="font-mono text-xs text-text-muted font-bold">
				{totalQuestions === 1 ? 'Item' : 'Items'}
			</span>
		</div>
		<span class="font-mono text-[10px] text-text-secondary mt-1">Extracted & Indexed</span>
	</div>

	<!-- Stat 3: Practice Time -->
	<div class="neo-box p-3.5 sm:p-5 flex flex-col justify-between">
		<div class="flex items-center justify-between text-text-muted mb-2">
			<span class="font-mono text-xs uppercase font-bold tracking-wider">Exam Duration</span>
			<div class="h-2.5 w-2.5 bg-accent-contrast"></div>
		</div>
		<div class="flex items-baseline gap-2">
			<span class="font-sans text-2xl sm:text-4xl font-black text-text-primary">
				{formatDuration(totalDurationMinutes)}
			</span>
		</div>
		<span class="font-mono text-[10px] text-text-secondary mt-1">Total timed test time</span>
	</div>
</div>
