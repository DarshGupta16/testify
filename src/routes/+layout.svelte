<script lang="ts">
import { onMount } from 'svelte';
import favicon from '$lib/assets/favicon.svg';
import Toast from '$lib/components/common/Toast.svelte';
import Header from '$lib/components/layout/Header.svelte';
import ApiKeysModal from '$lib/components/modals/ApiKeysModal.svelte';
import MasterPasswordModal from '$lib/components/modals/MasterPasswordModal.svelte';
import SubjectsModal from '$lib/components/modals/SubjectsModal.svelte';
import TestDetailsModal from '$lib/components/modals/TestDetailsModal.svelte';
import UploadModal from '$lib/components/modals/UploadModal.svelte';
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
	<ApiKeysModal />
	<MasterPasswordModal />
	<SubjectsModal />
	<Toast />
</div>
