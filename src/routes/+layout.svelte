<script lang="ts">
import { onMount } from 'svelte';
import favicon from '$lib/assets/favicon.svg';
import Header from '$lib/components/Header.svelte';
import TestDetailsModal from '$lib/components/TestDetailsModal.svelte';
import Toast from '$lib/components/Toast.svelte';
import UploadModal from '$lib/components/UploadModal.svelte';
import { AppStore, setAppContext } from '$lib/stores/appContext.svelte';
import './layout.css';

let { children } = $props();

// Instantiate client-isolated singleton store and provide via SvelteKit context
const app = new AppStore();
setAppContext(app);

onMount(() => {
	app.init();
});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="relative min-h-screen flex flex-col bg-canvas text-canvas-text font-sans">
	<!-- Background grid pattern texture -->
	<div class="pointer-events-none fixed inset-0 bg-grid-pattern z-0" aria-hidden="true"></div>

	<!-- Top Navigation Header -->
	<Header />

	<!-- Main Page View -->
	<main class="relative z-10 flex-1">
		{@render children()}
	</main>

	<!-- Global Modals & Notifications -->
	<UploadModal />
	<TestDetailsModal />
	<Toast />
</div>
