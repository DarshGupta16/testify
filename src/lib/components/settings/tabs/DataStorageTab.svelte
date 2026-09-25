<script lang="ts">
import { onMount } from 'svelte';
import { exportBackupData, importBackupData } from '$lib/services/backup';
import {
	clearDocumentAssetsCache,
	getStorageStats,
	type StorageStats,
} from '$lib/services/storageTelemetry';
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

let storageStats = $state<StorageStats>({
	testsCount: 0,
	attemptsCount: 0,
	foldersCount: 0,
	offlineOpsCount: 0,
	estimatedStorageMb: '0.00',
});

let fileInputRef = $state<HTMLInputElement | null>(null);
let isExporting = $state(false);
let isImporting = $state(false);
let isClearing = $state(false);

onMount(async () => {
	await refreshStats();
});

async function refreshStats() {
	storageStats = await getStorageStats();
}

async function handleExport() {
	try {
		isExporting = true;
		await exportBackupData();
		app.toast.show('Backup downloaded successfully.', 'success');
	} catch (err) {
		console.error('[DataStorageTab] Export backup failed:', err);
		app.toast.show('Failed to generate backup export.', 'error');
	} finally {
		isExporting = false;
	}
}

async function handleImport(e: Event) {
	const target = e.target as HTMLInputElement;
	const file = target.files?.[0];
	if (!file) return;

	try {
		isImporting = true;
		const counts = await importBackupData(file, app);
		await refreshStats();
		app.toast.show(
			`Imported ${counts.testsCount} tests and ${counts.foldersCount} folders successfully.`,
			'success'
		);
	} catch (err) {
		console.error('[DataStorageTab] Import failed:', err);
		app.toast.show(`Import failed: ${(err as Error).message}`, 'error');
	} finally {
		isImporting = false;
		target.value = '';
	}
}

async function handleClearCache() {
	if (
		!window.confirm(
			'Clear cached PDF page background scans? Your questions, diagrams, and scores will remain completely intact.'
		)
	) {
		return;
	}

	try {
		isClearing = true;
		await clearDocumentAssetsCache(app);
		await refreshStats();
		app.toast.show('Document page background cache cleared.', 'info');
	} catch (err) {
		console.error('[DataStorageTab] Failed clearing doc assets cache:', err);
		app.toast.show('Failed clearing cache.', 'error');
	} finally {
		isClearing = false;
	}
}
</script>

<div class="neo-box p-4 sm:p-6 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] space-y-6">
	<div class="border-b-2 border-border-color pb-3">
		<h2 class="font-sans text-lg font-extrabold uppercase tracking-tight">
			Storage, Backup & Data Portability
		</h2>
		<p class="font-mono text-xs text-text-muted">
			Inspect local IndexedDB disk telemetry and export or restore offline JSON archives
		</p>
	</div>

	<!-- Local Storage Breakdown -->
	<div class="neo-box p-4 bg-muted/20 border-2 border-border-color space-y-3">
		<div class="flex items-center justify-between">
			<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
				Local Device Storage (Dexie)
			</span>
			<button
				type="button"
				onclick={refreshStats}
				class="font-mono text-[10px] text-accent-contrast hover:underline uppercase font-bold cursor-pointer"
			>
				Refresh Telemetry
			</button>
		</div>

		<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
			<div class="p-2.5 bg-surface border border-border-color">
				<span class="text-text-muted text-[10px] block">Estimated Size</span>
				<span class="text-base font-bold">{storageStats.estimatedStorageMb} MB</span>
			</div>
			<div class="p-2.5 bg-surface border border-border-color">
				<span class="text-text-muted text-[10px] block">Tests Stored</span>
				<span class="text-base font-bold">{storageStats.testsCount}</span>
			</div>
			<div class="p-2.5 bg-surface border border-border-color">
				<span class="text-text-muted text-[10px] block">Attempts</span>
				<span class="text-base font-bold">{storageStats.attemptsCount}</span>
			</div>
			<div class="p-2.5 bg-surface border border-border-color">
				<span class="text-text-muted text-[10px] block">Offline Queue</span>
				<span class="text-base font-bold">{storageStats.offlineOpsCount} ops</span>
			</div>
		</div>
	</div>

	<!-- Export & Import Controls -->
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		<!-- Export Backup Card -->
		<div class="neo-box p-4 bg-muted/20 border-2 border-border-color space-y-2">
			<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
				Export Library Backup
			</span>
			<p class="font-mono text-xs text-text-muted leading-relaxed">
				Download a standalone JSON archive of all test papers, questions, folders, and history. Zero vendor lock-in.
			</p>
			<button
				type="button"
				disabled={isExporting}
				onclick={handleExport}
				class="neo-btn w-full mt-2 py-2 px-3 bg-accent-contrast text-accent-contrast-text text-xs font-bold uppercase tracking-wider disabled:opacity-50"
			>
				{isExporting ? 'Generating Backup...' : 'Download Backup (.json)'}
			</button>
		</div>

		<!-- Import Backup Card -->
		<div class="neo-box p-4 bg-muted/20 border-2 border-border-color space-y-2">
			<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
				Restore Library Backup
			</span>
			<p class="font-mono text-xs text-text-muted leading-relaxed">
				Restore a previously exported backup archive into your local library. Existing tests with matching IDs are preserved.
			</p>
			<input
				type="file"
				accept=".json"
				bind:this={fileInputRef}
				onchange={handleImport}
				class="hidden"
			/>
			<button
				type="button"
				disabled={isImporting}
				onclick={() => fileInputRef?.click()}
				class="neo-btn w-full mt-2 py-2 px-3 bg-surface hover:bg-muted text-text-primary border-2 border-border-color text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_var(--shadow-color)] disabled:opacity-50"
			>
				{isImporting ? 'Restoring Archive...' : 'Select Backup File...'}
			</button>
		</div>
	</div>

	<!-- Cache Clearing -->
	<div class="pt-2 border-t border-border-color/40 flex items-center justify-between">
		<div class="space-y-0.5">
			<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
				Free Local Storage
			</span>
			<p class="font-mono text-[11px] text-text-muted">
				Wipe document page background bitmaps from IndexedDB. Questions and scores are preserved.
			</p>
		</div>
		<button
			type="button"
			disabled={isClearing}
			onclick={handleClearCache}
			class="neo-btn py-1.5 px-3 text-xs font-mono font-bold uppercase bg-surface hover:bg-muted disabled:opacity-50"
		>
			{isClearing ? 'Clearing...' : 'Clear Document Cache'}
		</button>
	</div>
</div>
