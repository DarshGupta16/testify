<script lang="ts">
import { goto, preloadCode } from '$app/navigation';
import { getAppContext } from '$lib/stores/appContext.svelte';

interface Props {
	testId: string;
	disabled?: boolean;
	onselect?: (mode: 'practice' | 'exam') => void;
}

const { testId, disabled = false, onselect }: Props = $props();

const app = getAppContext();

let isSelectingMode = $state(false);
let startButtonRef = $state<HTMLButtonElement | null>(null);
let modeTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
	if (modeTimer) {
		clearTimeout(modeTimer);
		modeTimer = null;
	}
}

function cancelModeSelection() {
	clearTimer();
	isSelectingMode = false;
	startButtonRef?.focus();
}

function handleStartClick() {
	if (disabled) return;
	isSelectingMode = true;
	clearTimer();
	modeTimer = setTimeout(() => {
		isSelectingMode = false;
		modeTimer = null;
	}, 10000);
}

function handleSelectPractice() {
	clearTimer();
	isSelectingMode = false;
	if (onselect) {
		onselect('practice');
	} else {
		goto(`/test/${testId}?start=true&mode=practice`);
	}
}

function handleSelectExam() {
	clearTimer();
	isSelectingMode = false;
	if (onselect) {
		onselect('exam');
	} else {
		goto(`/test/${testId}?start=true&mode=exam`);
	}
}

$effect(() => {
	return () => {
		clearTimer();
	};
});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && isSelectingMode) {
			e.stopPropagation();
			cancelModeSelection();
		}
	}}
/>

{#if isSelectingMode}
	<div class="grid grid-cols-2 gap-2 animate-slide-down">
		<button
			type="button"
			onmouseenter={() => {
				preloadCode(`/test/${testId}`);
				app.tests.prefetchTestDocAssets(testId);
			}}
			onfocus={() => {
				preloadCode(`/test/${testId}`);
				app.tests.prefetchTestDocAssets(testId);
			}}
			onclick={handleSelectPractice}
			class="neo-btn text-[11px] py-2.5 px-2 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25 font-bold truncate cursor-pointer"
			title="Start in Practice Mode"
		>
			🌿 Practice
		</button>
		<button
			type="button"
			onmouseenter={() => {
				preloadCode(`/test/${testId}`);
				app.tests.prefetchTestDocAssets(testId);
			}}
			onfocus={() => {
				preloadCode(`/test/${testId}`);
				app.tests.prefetchTestDocAssets(testId);
			}}
			onclick={handleSelectExam}
			class="neo-btn neo-btn-primary text-[11px] py-2.5 px-2 font-bold truncate cursor-pointer"
			title="Start Exam Simulation"
		>
			🎯 Exam Sim
		</button>
	</div>
{:else}
	<button
		bind:this={startButtonRef}
		type="button"
		{disabled}
		onmouseenter={() => {
			preloadCode(`/test/${testId}`);
			app.tests.prefetchTestDocAssets(testId);
		}}
		onfocus={() => {
			preloadCode(`/test/${testId}`);
			app.tests.prefetchTestDocAssets(testId);
		}}
		onclick={handleStartClick}
		class="neo-btn neo-btn-primary w-full text-xs py-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="square"
			class="h-3.5 w-3.5"
		>
			<polygon points="5 3 19 12 5 21 5 3" />
		</svg>
		<span>Start Test</span>
	</button>
{/if}
