<script lang="ts">
import AccountTab from '$lib/components/settings/tabs/AccountTab.svelte';
import AiTab from '$lib/components/settings/tabs/AiTab.svelte';
import AppearanceTab from '$lib/components/settings/tabs/AppearanceTab.svelte';
import DataStorageTab from '$lib/components/settings/tabs/DataStorageTab.svelte';
import ExamGradingTab from '$lib/components/settings/tabs/ExamGradingTab.svelte';
import PdfEngineTab from '$lib/components/settings/tabs/PdfEngineTab.svelte';
import SecurityTab from '$lib/components/settings/tabs/SecurityTab.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

type SettingsTab = 'account' | 'ai' | 'security' | 'pdf' | 'exam' | 'storage' | 'appearance';

let activeTab = $state<SettingsTab>('account');

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
	{ id: 'account', label: 'Account & Cloud', icon: '👤' },
	{ id: 'ai', label: 'AI & Generation', icon: '🤖' },
	{ id: 'security', label: 'Security & Keys', icon: '🔒' },
	{ id: 'pdf', label: 'PDF & Engine', icon: '📄' },
	{ id: 'exam', label: 'Exam & Grading', icon: '📝' },
	{ id: 'storage', label: 'Data & Backup', icon: '💾' },
	{ id: 'appearance', label: 'Appearance', icon: '🎨' },
];
</script>

<svelte:head>
	<title>Settings — Testify</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-border-color pb-4">
		<div class="space-y-1">
			<div class="flex items-center gap-2">
				<a
					href="/"
					class="font-mono text-xs font-bold text-accent-contrast hover:underline uppercase tracking-wider flex items-center gap-1"
				>
					← Dashboard
				</a>
				<span class="text-text-muted">/</span>
				<span class="font-mono text-xs text-text-muted uppercase">Settings</span>
			</div>
			<h1 class="font-sans text-xl sm:text-2xl font-extrabold uppercase tracking-tight">
				Application Settings & Preferences
			</h1>
		</div>

		<!-- Status Badge -->
		<div class="flex items-center gap-2">
			{#if app.auth.isAuthenticated}
				<span class="neo-badge bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/50 font-mono text-[11px] font-bold">
					● Cloud Synced ({app.auth.userEmail})
				</span>
			{:else}
				<span class="neo-badge bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/50 font-mono text-[11px] font-bold">
					○ Guest / Local Mode
				</span>
			{/if}
		</div>
	</div>

	<!-- Main Settings Layout -->
	<div class="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6 items-start">
		<!-- Sidebar Navigation (Desktop) / Tab List (Mobile) -->
		<nav class="md:col-span-1 space-y-1 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] p-2">
			{#each TABS as tab (tab.id)}
				<button
					type="button"
					onclick={() => (activeTab = tab.id)}
					class="w-full text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-between transition-colors {activeTab === tab.id
						? 'bg-accent-contrast text-accent-contrast-text'
						: 'text-text-secondary hover:bg-muted/50 hover:text-text-primary'}"
				>
					<span>{tab.icon} {tab.label}</span>
					{#if tab.id === 'account' && app.auth.isAuthenticated}
						<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
					{:else if tab.id === 'security'}
						<span class="text-[10px] opacity-75">{app.security.securityMode}</span>
					{:else if tab.id === 'pdf'}
						<span class="text-[10px] opacity-75">{app.selectedScale}x</span>
					{:else if tab.id === 'appearance'}
						<span class="text-[10px] opacity-75">{app.theme.theme}</span>
					{/if}
				</button>
			{/each}
		</nav>

		<!-- Settings Content Panels -->
		<div class="md:col-span-3 lg:col-span-4 space-y-6">
			{#if activeTab === 'account'}
				<AccountTab />
			{:else if activeTab === 'ai'}
				<AiTab />
			{:else if activeTab === 'security'}
				<SecurityTab />
			{:else if activeTab === 'pdf'}
				<PdfEngineTab />
			{:else if activeTab === 'exam'}
				<ExamGradingTab />
			{:else if activeTab === 'storage'}
				<DataStorageTab />
			{:else if activeTab === 'appearance'}
				<AppearanceTab />
			{/if}
		</div>
	</div>
</div>
