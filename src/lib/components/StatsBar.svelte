<script lang="ts">
import { getTestStore } from '$lib/stores/testStore.svelte';

const store = getTestStore();

function formatDuration(totalMins: number): string {
	if (totalMins < 60) return `${totalMins}m`;
	const hours = (totalMins / 60).toFixed(1);
	return `${hours} hrs`;
}
</script>

<div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
	<!-- Stat 1: Total Tests -->
	<div class="neo-box p-4 sm:p-5 flex flex-col justify-between">
		<div class="flex items-center justify-between text-text-muted mb-2">
			<span class="font-mono text-xs uppercase font-bold tracking-wider">Total Tests</span>
			<div class="h-2.5 w-2.5 bg-accent-contrast"></div>
		</div>
		<div class="flex items-baseline gap-2">
			<span class="font-sans text-2xl sm:text-4xl font-black text-text-primary">
				{store.totalTests}
			</span>
			<span class="font-mono text-xs text-text-muted font-bold">Tests</span>
		</div>
		<span class="font-mono text-[10px] text-text-secondary mt-1">Ready for practice</span>
	</div>

	<!-- Stat 2: Total Questions -->
	<div class="neo-box p-4 sm:p-5 flex flex-col justify-between">
		<div class="flex items-center justify-between text-text-muted mb-2">
			<span class="font-mono text-xs uppercase font-bold tracking-wider">Total Questions</span>
			<div class="h-2.5 w-2.5 bg-accent-contrast"></div>
		</div>
		<div class="flex items-baseline gap-2">
			<span class="font-sans text-2xl sm:text-4xl font-black text-text-primary">
				{store.totalQuestions}
			</span>
			<span class="font-mono text-xs text-text-muted font-bold">Items</span>
		</div>
		<span class="font-mono text-[10px] text-text-secondary mt-1">Extracted & Indexed</span>
	</div>

	<!-- Stat 3: Practice Time -->
	<div class="neo-box p-4 sm:p-5 flex flex-col justify-between">
		<div class="flex items-center justify-between text-text-muted mb-2">
			<span class="font-mono text-xs uppercase font-bold tracking-wider">Exam Duration</span>
			<div class="h-2.5 w-2.5 bg-accent-contrast"></div>
		</div>
		<div class="flex items-baseline gap-2">
			<span class="font-sans text-2xl sm:text-4xl font-black text-text-primary">
				{formatDuration(store.totalDurationMinutes)}
			</span>
		</div>
		<span class="font-mono text-[10px] text-text-secondary mt-1">Total timed test time</span>
	</div>

	<!-- Stat 4: Answer Key Coverage -->
	<div class="neo-box p-4 sm:p-5 flex flex-col justify-between">
		<div class="flex items-center justify-between text-text-muted mb-2">
			<span class="font-mono text-xs uppercase font-bold tracking-wider">Auto-Graded</span>
			<div class="h-2.5 w-2.5 bg-emerald-500"></div>
		</div>
		<div class="flex items-baseline gap-2">
			<span class="font-sans text-2xl sm:text-4xl font-black text-text-primary">
				{store.answerKeyCoverage}%
			</span>
			<span class="font-mono text-xs text-emerald-600 font-bold">Key Linked</span>
		</div>
		<span class="font-mono text-[10px] text-text-secondary mt-1">Instant scoring enabled</span>
	</div>
</div>
