<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';
import { formatDuration } from '$lib/utils';

const app = getAppContext();
</script>

<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
	<!-- Stat 1: Total Tests -->
	<div class="neo-box p-4 sm:p-5 flex flex-col justify-between">
		<div class="flex items-center justify-between text-text-muted mb-2">
			<span class="font-mono text-xs uppercase font-bold tracking-wider">Total Tests</span>
			<div class="h-2.5 w-2.5 bg-accent-contrast"></div>
		</div>
		<div class="flex items-baseline gap-2">
			<span class="font-sans text-2xl sm:text-4xl font-black text-text-primary">
				{app.tests.totalTests}
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
				{app.tests.totalQuestions}
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
				{formatDuration(app.tests.totalDurationMinutes)}
			</span>
		</div>
		<span class="font-mono text-[10px] text-text-secondary mt-1">Total timed test time</span>
	</div>
</div>
