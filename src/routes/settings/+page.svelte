<script lang="ts">
import { onMount } from 'svelte';
import SecurityModeControl from '$lib/components/modals/keys/SecurityModeControl.svelte';
import ExamModeMiniPreview from '$lib/components/settings/ExamModeMiniPreview.svelte';
import { db } from '$lib/services/db';
import type { EvaluationMode, ExamViewMode, KatexFontSize } from '$lib/services/settings';
import { getAppContext } from '$lib/stores/appContext.svelte';
import { AI_PROVIDERS, type AIProvider } from '$lib/types/apiKeys';

const app = getAppContext();

type SettingsTab = 'account' | 'ai' | 'security' | 'pdf' | 'exam' | 'storage' | 'appearance';

let activeTab = $state<SettingsTab>('account');

// Account Form States
let newEmailInput = $state('');
let newPasswordInput = $state('');
let confirmPasswordInput = $state('');
let accountMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
let isUpdatingAccount = $state(false);
let cloudTelemetry = $state<{ testCount: number; attemptCount: number } | null>(null);

// Storage Telemetry States
let storageStats = $state<{
	testsCount: number;
	attemptsCount: number;
	foldersCount: number;
	offlineOpsCount: number;
	estimatedStorageMb: string;
}>({
	testsCount: 0,
	attemptsCount: 0,
	foldersCount: 0,
	offlineOpsCount: 0,
	estimatedStorageMb: '0.00',
});

// JSON Import File Input
let fileInputRef = $state<HTMLInputElement | null>(null);

const selectedProviderMeta = $derived(
	AI_PROVIDERS.find((p) => p.id === app.settings.defaultAiProvider) || AI_PROVIDERS[0]
);

const DURATION_PRESETS = [30, 45, 60, 90, 120, 180];

const DIRECTIVE_PRESETS = [
	'Format all equations using clean KaTeX notation',
	'Provide thorough step-by-step mathematical derivations',
	'Emphasize conceptual discrimination and distractor analysis',
	'Increase numerical question ratio and dimensional checks',
	'Include comprehensive explanations for all answer options',
];

const MARKING_SCHEME_PRESETS = [
	{ name: 'JEE Advanced', pos: 4, neg: 1 },
	{ name: 'JEE Main', pos: 4, neg: 1 },
	{ name: 'NEET', pos: 4, neg: 1 },
	{ name: 'SAT / General', pos: 1, neg: 0 },
	{ name: 'University', pos: 3, neg: 0 },
	{ name: 'Strict Penalty', pos: 4, neg: 2 },
];

onMount(async () => {
	await refreshStorageStats();
	if (app.auth.isAuthenticated) {
		cloudTelemetry = await app.auth.getCloudTelemetry();
	}
});

async function refreshStorageStats() {
	try {
		const [tests, attempts, folders, ops] = await Promise.all([
			db.getAllTests(),
			db.getAllAttempts(),
			db.getAllFolders(),
			db.offlineOps.count(),
		]);

		let storageMb = '0.00';
		if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
			const est = await navigator.storage.estimate();
			if (est.usage) {
				storageMb = (est.usage / (1024 * 1024)).toFixed(2);
			}
		}

		storageStats = {
			testsCount: tests.length,
			attemptsCount: attempts.length,
			foldersCount: folders.length,
			offlineOpsCount: ops,
			estimatedStorageMb: storageMb,
		};
	} catch (err) {
		console.error('[Settings] Failed loading storage stats:', err);
	}
}

async function handleUpdateEmail(e: SubmitEvent) {
	e.preventDefault();
	if (!newEmailInput.trim()) return;

	isUpdatingAccount = true;
	accountMessage = null;
	try {
		const res = await app.auth.updateEmail(newEmailInput.trim());
		if (res.error) {
			accountMessage = { type: 'error', text: res.error.message };
		} else {
			accountMessage = {
				type: 'success',
				text: res.message || 'Email update requested. Please check your inbox.',
			};
			newEmailInput = '';
		}
	} finally {
		isUpdatingAccount = false;
	}
}

async function handleUpdatePassword(e: SubmitEvent) {
	e.preventDefault();
	if (!newPasswordInput || newPasswordInput.length < 6) {
		accountMessage = {
			type: 'error',
			text: 'Password must be at least 6 characters.',
		};
		return;
	}
	if (newPasswordInput !== confirmPasswordInput) {
		accountMessage = { type: 'error', text: 'Passwords do not match.' };
		return;
	}

	isUpdatingAccount = true;
	accountMessage = null;
	try {
		const res = await app.auth.updatePassword(newPasswordInput);
		if (res.error) {
			accountMessage = { type: 'error', text: res.error.message };
		} else {
			accountMessage = {
				type: 'success',
				text: 'Password updated successfully!',
			};
			newPasswordInput = '';
			confirmPasswordInput = '';
		}
	} finally {
		isUpdatingAccount = false;
	}
}

async function handleExportBackup() {
	try {
		const [tests, folders, subjects, attempts] = await Promise.all([
			db.getAllTests(),
			db.getAllFolders(),
			db.getAllSubjects(),
			db.getAllAttempts(),
		]);

		const backupPayload = {
			version: 1,
			exportedAt: new Date().toISOString(),
			data: { tests, folders, subjects, attempts },
		};

		const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
			type: 'application/json',
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `testify-backup-${new Date().toISOString().slice(0, 10)}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		app.toast.show('Backup downloaded successfully.', 'success');
	} catch (err) {
		console.error('[Settings] Export backup failed:', err);
		app.toast.show('Failed to generate backup export.', 'error');
	}
}

async function handleImportBackup(e: Event) {
	const target = e.target as HTMLInputElement;
	const file = target.files?.[0];
	if (!file) return;

	try {
		const text = await file.text();
		const parsed = JSON.parse(text);

		if (!parsed.data || !Array.isArray(parsed.data.tests)) {
			throw new Error('Invalid backup file structure.');
		}

		const { tests = [], folders = [], subjects = [], attempts = [] } = parsed.data;

		if (folders.length > 0) await db.bulkSaveFolders(folders);
		if (tests.length > 0) await db.bulkSaveTests(tests);
		if (attempts.length > 0) await db.bulkSaveAttempts(attempts);

		// Refresh in-memory stores
		app.folders.folders = await db.getAllFolders();
		app.tests.tests = await db.getAllTests();
		app.folders.rebuildIndices(app.tests.tests);
		app.attempts.attempts = await db.getAllAttempts();

		await refreshStorageStats();
		app.toast.show(
			`Imported ${tests.length} tests and ${folders.length} folders successfully.`,
			'success'
		);
	} catch (err) {
		console.error('[Settings] Import failed:', err);
		app.toast.show(`Import failed: ${(err as Error).message}`, 'error');
	} finally {
		target.value = '';
	}
}

async function handleClearDocumentCache() {
	if (
		!window.confirm(
			'Clear cached PDF page background scans? Your questions, diagrams, and scores will remain completely intact.'
		)
	) {
		return;
	}

	try {
		await db.testDocAssets.clear();
		app.tests.docAssetsCache.clear();
		await refreshStorageStats();
		app.toast.show('Document page background cache cleared.', 'info');
	} catch (err) {
		console.error('[Settings] Failed clearing doc assets cache:', err);
		app.toast.show('Failed clearing cache.', 'error');
	}
}
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
			<button
				type="button"
				onclick={() => (activeTab = 'account')}
				class="w-full text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-between transition-colors {activeTab === 'account'
					? 'bg-accent-contrast text-accent-contrast-text'
					: 'text-text-secondary hover:bg-muted/50 hover:text-text-primary'}"
			>
				<span>👤 Account & Cloud</span>
				{#if app.auth.isAuthenticated}
					<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
				{/if}
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'ai')}
				class="w-full text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-between transition-colors {activeTab === 'ai'
					? 'bg-accent-contrast text-accent-contrast-text'
					: 'text-text-secondary hover:bg-muted/50 hover:text-text-primary'}"
			>
				<span>🤖 AI & Generation</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'security')}
				class="w-full text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-between transition-colors {activeTab === 'security'
					? 'bg-accent-contrast text-accent-contrast-text'
					: 'text-text-secondary hover:bg-muted/50 hover:text-text-primary'}"
			>
				<span>🔒 Security & Keys</span>
				<span class="text-[10px] opacity-75">{app.security.securityMode}</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'pdf')}
				class="w-full text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-between transition-colors {activeTab === 'pdf'
					? 'bg-accent-contrast text-accent-contrast-text'
					: 'text-text-secondary hover:bg-muted/50 hover:text-text-primary'}"
			>
				<span>📄 PDF & Engine</span>
				<span class="text-[10px] opacity-75">{app.selectedScale}x</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'exam')}
				class="w-full text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-between transition-colors {activeTab === 'exam'
					? 'bg-accent-contrast text-accent-contrast-text'
					: 'text-text-secondary hover:bg-muted/50 hover:text-text-primary'}"
			>
				<span>📝 Exam & Grading</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'storage')}
				class="w-full text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-between transition-colors {activeTab === 'storage'
					? 'bg-accent-contrast text-accent-contrast-text'
					: 'text-text-secondary hover:bg-muted/50 hover:text-text-primary'}"
			>
				<span>💾 Data & Backup</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'appearance')}
				class="w-full text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-between transition-colors {activeTab === 'appearance'
					? 'bg-accent-contrast text-accent-contrast-text'
					: 'text-text-secondary hover:bg-muted/50 hover:text-text-primary'}"
			>
				<span>🎨 Appearance</span>
				<span class="text-[10px] opacity-75">{app.theme.theme}</span>
			</button>
		</nav>

		<!-- Settings Content Panels -->
		<div class="md:col-span-3 lg:col-span-4 space-y-6">
			<!-- TAB 1: ACCOUNT & CLOUD -->
			{#if activeTab === 'account'}
				<div class="neo-box p-4 sm:p-6 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] space-y-6">
					<div class="border-b-2 border-border-color pb-3">
						<h2 class="font-sans text-lg font-extrabold uppercase tracking-tight">
							Account & Cloud Synchronization
						</h2>
						<p class="font-mono text-xs text-text-muted">
							Manage your cloud credentials and cross-device sync status
						</p>
					</div>

					{#if accountMessage}
						<div
							class="neo-box p-3 font-mono text-xs {accountMessage.type === 'success'
								? 'bg-emerald-500/10 border-2 border-emerald-500 text-emerald-700 dark:text-emerald-300'
								: 'bg-rose-500/10 border-2 border-rose-500 text-rose-700 dark:text-rose-300'}"
						>
							{accountMessage.text}
						</div>
					{/if}

					{#if app.auth.isAuthenticated}
						<!-- Email Update Section -->
						<form onsubmit={handleUpdateEmail} class="neo-box p-4 bg-muted/20 border-2 border-border-color space-y-3">
							<div class="flex items-center justify-between">
								<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
									Primary Account Email
								</span>
								<span class="font-mono text-xs text-text-secondary font-bold underline">
									{app.auth.userEmail}
								</span>
							</div>

							<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
								<input
									type="email"
									bind:value={newEmailInput}
									placeholder="New email address..."
									required
									class="sm:col-span-2 neo-input text-xs font-mono py-2"
								/>
								<button
									type="submit"
									disabled={isUpdatingAccount || !newEmailInput.trim()}
									class="neo-btn bg-accent-contrast text-accent-contrast-text text-xs font-bold uppercase tracking-wider"
								>
									Change Email
								</button>
							</div>
							<p class="font-mono text-[11px] text-text-muted">
								A confirmation link will be sent to the new address before the update is applied.
							</p>
						</form>

						<!-- Password Update Section -->
						<form onsubmit={handleUpdatePassword} class="neo-box p-4 bg-muted/20 border-2 border-border-color space-y-3">
							<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
								Change Password
							</span>

							<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<label for="new-pw" class="font-mono text-[10px] uppercase text-text-muted block mb-1">
										New Password
									</label>
									<input
										id="new-pw"
										type="password"
										bind:value={newPasswordInput}
										minlength="6"
										placeholder="••••••••"
										required
										class="w-full neo-input text-xs font-mono py-2"
									/>
								</div>
								<div>
									<label for="confirm-pw" class="font-mono text-[10px] uppercase text-text-muted block mb-1">
										Confirm New Password
									</label>
									<input
										id="confirm-pw"
										type="password"
										bind:value={confirmPasswordInput}
										minlength="6"
										placeholder="••••••••"
										required
										class="w-full neo-input text-xs font-mono py-2"
									/>
								</div>
							</div>

							<button
								type="submit"
								disabled={isUpdatingAccount || !newPasswordInput}
								class="neo-btn bg-surface hover:bg-muted text-text-primary text-xs font-bold uppercase tracking-wider border-2 border-border-color shadow-[2px_2px_0px_var(--shadow-color)]"
							>
								Update Password
							</button>
						</form>

						<!-- Cloud Telemetry Card -->
						<div class="neo-box p-4 bg-muted/20 border-2 border-border-color space-y-3">
							<div class="flex items-center justify-between">
								<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
									Cloud Storage Telemetry
								</span>
								<button
									type="button"
									onclick={() => app.auth.syncNow()}
									class="neo-btn text-[11px] font-mono font-bold uppercase py-1 px-2.5 bg-accent-contrast text-accent-contrast-text"
								>
									Force Sync Now
								</button>
							</div>

							<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
								<div class="p-2.5 bg-surface border border-border-color">
									<span class="text-text-muted text-[10px] block">Cloud Tests</span>
									<span class="text-base font-bold">{cloudTelemetry?.testCount ?? '—'}</span>
								</div>
								<div class="p-2.5 bg-surface border border-border-color">
									<span class="text-text-muted text-[10px] block">Exam Attempts</span>
									<span class="text-base font-bold">{cloudTelemetry?.attemptCount ?? '—'}</span>
								</div>
								<div class="p-2.5 bg-surface border border-border-color col-span-2 sm:col-span-1">
									<span class="text-text-muted text-[10px] block">Sync Engine</span>
									<span class="text-base font-bold uppercase {app.auth.syncStatus === 'synced' ? 'text-emerald-500' : 'text-amber-500'}">
										{app.auth.syncStatus}
									</span>
								</div>
							</div>
						</div>

						<!-- Danger Zone: Account Deletion -->
						<div class="neo-box p-4 bg-rose-500/5 border-2 border-rose-500/40 space-y-3">
							<div class="flex items-center gap-2">
								<span class="h-2 w-2 rounded-full bg-rose-500"></span>
								<span class="font-mono text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
									Danger Zone: Delete Account
								</span>
							</div>
							<p class="font-mono text-xs text-text-muted leading-relaxed">
								Permanently delete your account. You will be prompted to choose whether to delete only your cloud data (keeping local papers on this device) or erase everything everywhere.
							</p>
							<button
								type="button"
								onclick={() => app.modals.openDeleteAccount()}
								class="neo-btn py-2 px-3.5 bg-rose-500 text-white hover:bg-rose-600 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_var(--shadow-color)]"
							>
								Delete Account...
							</button>
						</div>
					{:else}
						<!-- Guest Mode Notification -->
						<div class="neo-box p-4 sm:p-5 bg-muted/30 border-2 border-border-color space-y-3">
							<div class="flex items-center gap-2">
								<span class="h-2 w-2 rounded-full bg-amber-500"></span>
								<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
									Guest / Offline Mode Active
								</span>
							</div>
							<p class="font-mono text-xs text-text-secondary leading-relaxed">
								You are currently using Testify without an account. All your test papers, question diagrams, and exam history remain safely saved on this computer in your browser storage.
							</p>
							<p class="font-mono text-xs text-text-muted leading-relaxed">
								Signing in or creating an account unlocks seamless cross-device cloud sync with encrypted backups across your phone, tablet, and laptop.
							</p>
							<button
								type="button"
								onclick={() => app.modals.openAuth('signin')}
								class="neo-btn py-2.5 px-4 bg-accent-contrast text-accent-contrast-text text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--shadow-color)]"
							>
								Sign In or Create Account
							</button>
						</div>
					{/if}
				</div>
			{/if}

			<!-- TAB 2: AI & GENERATION -->
			{#if activeTab === 'ai'}
				<div class="neo-box p-4 sm:p-6 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] space-y-6">
					<div class="border-b-2 border-border-color pb-3">
						<h2 class="font-sans text-lg font-extrabold uppercase tracking-tight">
							AI & Generation Defaults
						</h2>
						<p class="font-mono text-xs text-text-muted">
							Configure default providers, models, and custom prompts for PDF assessment generation
						</p>
					</div>

					<div class="space-y-4">
						<!-- Default Provider -->
						<div class="space-y-1.5">
							<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
								Default AI Provider
							</span>
							<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
								{#each AI_PROVIDERS as p (p.id)}
									<button
										type="button"
										onclick={() => {
											app.settings.setDefaultAiProvider(p.id);
											if (!p.suggestedModels.includes(app.settings.defaultAiModel)) {
												app.settings.setDefaultAiModel(p.defaultModel);
											}
										}}
										class="p-2.5 border-2 text-xs font-mono font-bold uppercase transition-all flex items-center justify-between {app.settings.defaultAiProvider === p.id
											? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)]'
											: 'bg-surface hover:bg-muted/50 border-border-color text-text-primary'}"
									>
										<span>{p.name}</span>
										{#if app.apiKeys.configuredProviders[p.id]}
											<span class="text-[9px] text-emerald-500 font-bold">✓ Key</span>
										{/if}
									</button>
								{/each}
							</div>
						</div>

						<!-- Default Model Name & Presets -->
						<div class="space-y-1.5">
							<div class="flex items-center justify-between">
								<label for="default-model" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
									Default Model Identifier
								</label>
								<span class="font-mono text-[10px] text-text-muted">
									Default: {selectedProviderMeta.defaultModel}
								</span>
							</div>
							<input
								id="default-model"
								type="text"
								list="settings-model-suggestions"
								value={app.settings.defaultAiModel}
								onchange={(e) => app.settings.setDefaultAiModel(e.currentTarget.value.trim())}
								placeholder={selectedProviderMeta.defaultModel}
								class="neo-input w-full text-xs font-mono py-2"
							/>
							<datalist id="settings-model-suggestions">
								{#each selectedProviderMeta.suggestedModels as sug}
									<option value={sug}></option>
								{/each}
							</datalist>

							<!-- Model Presets Chips -->
							<div class="flex flex-wrap items-center gap-1.5 pt-1">
								<span class="font-mono text-[10px] text-text-muted uppercase font-bold mr-1">Presets:</span>
								{#each selectedProviderMeta.suggestedModels as modelPreset}
									<button
										type="button"
										onclick={() => app.settings.setDefaultAiModel(modelPreset)}
										class="font-mono text-[10px] px-2 py-0.5 border border-border-color transition-colors cursor-pointer {app.settings.defaultAiModel === modelPreset
											? 'bg-accent-contrast text-accent-contrast-text font-bold shadow-[1px_1px_0px_var(--shadow-color)]'
											: 'bg-surface hover:bg-muted text-text-secondary'}"
									>
										{modelPreset}
									</button>
								{/each}
							</div>

							{#if selectedProviderMeta.visionNotice}
								<div class="p-2 bg-muted/50 border border-border-color/50 text-[11px] text-text-secondary font-mono flex items-start gap-1.5 mt-2">
									<span class="text-accent-contrast font-bold">ℹ️ Note:</span>
									<span>{selectedProviderMeta.visionNotice}</span>
								</div>
							{/if}
						</div>

						<!-- Default Duration & Untimed -->
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border-color/40">
							<div class="space-y-1.5">
								<label for="default-duration" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
									Default Exam Duration (Minutes)
								</label>
								<input
									id="default-duration"
									type="number"
									min="5"
									max="360"
									disabled={app.settings.defaultIsUntimed}
									value={app.settings.defaultDurationMinutes}
									onchange={(e) => app.settings.setDefaultDurationMinutes(Number(e.currentTarget.value))}
									class="neo-input w-full text-xs font-mono py-2 disabled:opacity-40"
								/>

								<!-- Duration Presets -->
								<div class="flex flex-wrap items-center gap-1.5 pt-1">
									<span class="font-mono text-[10px] text-text-muted uppercase font-bold mr-1">Presets:</span>
									{#each DURATION_PRESETS as mins}
										<button
											type="button"
											disabled={app.settings.defaultIsUntimed}
											onclick={() => app.settings.setDefaultDurationMinutes(mins)}
											class="font-mono text-[10px] px-2 py-0.5 border border-border-color transition-colors cursor-pointer disabled:opacity-30 {app.settings.defaultDurationMinutes === mins && !app.settings.defaultIsUntimed
												? 'bg-accent-contrast text-accent-contrast-text font-bold shadow-[1px_1px_0px_var(--shadow-color)]'
												: 'bg-surface hover:bg-muted text-text-secondary'}"
										>
											{mins}m
										</button>
									{/each}
								</div>
							</div>

							<div class="flex items-center gap-3 pt-6">
								<label class="relative inline-flex items-center cursor-pointer">
									<input
										type="checkbox"
										checked={app.settings.defaultIsUntimed}
										onchange={(e) => app.settings.setDefaultIsUntimed(e.currentTarget.checked)}
										class="sr-only peer"
									/>
									<div class="w-9 h-5 bg-muted border-2 border-border-color peer-focus:outline-hidden peer-checked:bg-accent-contrast transition-colors shadow-[1px_1px_0px_var(--shadow-color)]"></div>
									<div class="absolute left-0.5 top-0.5 bg-surface border-2 border-border-color w-4 h-4 transition-transform peer-checked:translate-x-4"></div>
								</label>
								<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
									Default to Untimed Practice
								</span>
							</div>
						</div>

						<!-- Auto-generate Title -->
						<div class="flex items-center justify-between pt-3 border-t border-border-color/40">
							<div class="space-y-0.5">
								<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
									Auto-Generate Test Titles
								</span>
								<p class="font-mono text-[11px] text-text-muted">
									Automatically infer clean assessment titles from PDF headers
								</p>
							</div>
							<label class="relative inline-flex items-center cursor-pointer">
								<input
									type="checkbox"
									checked={app.settings.autoTitleDefault}
									onchange={(e) => app.settings.setAutoTitleDefault(e.currentTarget.checked)}
									class="sr-only peer"
								/>
								<div class="w-9 h-5 bg-muted border-2 border-border-color peer-focus:outline-hidden peer-checked:bg-accent-contrast transition-colors shadow-[1px_1px_0px_var(--shadow-color)]"></div>
								<div class="absolute left-0.5 top-0.5 bg-surface border-2 border-border-color w-4 h-4 transition-transform peer-checked:translate-x-4"></div>
							</label>
						</div>

						<!-- Global Custom Prompt Instructions & Presets -->
						<div class="space-y-1.5 pt-3 border-t border-border-color/40">
							<label for="custom-inst" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
								Global System Instructions Template
							</label>
							<textarea
								id="custom-inst"
								rows="3"
								value={app.settings.globalCustomInstructions}
								onchange={(e) => app.settings.setGlobalCustomInstructions(e.currentTarget.value)}
								placeholder="e.g. Always format equations using KaTeX notation. Include detailed step-by-step solutions for mathematics questions..."
								class="neo-input w-full text-xs font-mono p-2.5 resize-y"
							></textarea>
							<p class="font-mono text-[10px] text-text-muted">
								These instructions are automatically appended to all PDF testify and similar paper generation requests.
							</p>

							<!-- Quick Directive Presets -->
							<div class="space-y-1.5 pt-1">
								<div class="flex items-center justify-between">
									<span class="font-mono text-[10px] font-bold uppercase text-text-muted block">
										Quick Directive Presets:
									</span>
									{#if app.settings.globalCustomInstructions}
										<button
											type="button"
											onclick={() => app.settings.setGlobalCustomInstructions('')}
											class="font-mono text-[10px] text-rose-500 hover:underline cursor-pointer uppercase font-bold"
										>
											Clear All
										</button>
									{/if}
								</div>
								<div class="flex flex-wrap items-center gap-1.5">
									{#each DIRECTIVE_PRESETS as suggestion}
										<button
											type="button"
											onclick={() => {
												const current = app.settings.globalCustomInstructions.trim();
												if (!current) {
													app.settings.setGlobalCustomInstructions(suggestion);
												} else if (!current.includes(suggestion)) {
													app.settings.setGlobalCustomInstructions(`${current}\n- ${suggestion}`);
												}
											}}
											class="font-mono text-[10px] py-1 px-2 border border-border-color bg-surface hover:bg-muted/70 text-text-secondary hover:text-text-primary transition-colors cursor-pointer flex items-center gap-1"
										>
											<span>+</span>
											<span>{suggestion}</span>
										</button>
									{/each}
								</div>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- TAB 3: SECURITY & KEYS -->
			{#if activeTab === 'security'}
				<div class="neo-box p-4 sm:p-6 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] space-y-6">
					<div class="border-b-2 border-border-color pb-3 flex items-center justify-between">
						<div>
							<h2 class="font-sans text-lg font-extrabold uppercase tracking-tight">
								Security & Credentials
							</h2>
							<p class="font-mono text-xs text-text-muted">
								Encryption tier, master password, and provider API keys
							</p>
						</div>
						<button
							type="button"
							onclick={() => app.modals.openApiKeys()}
							class="neo-btn text-xs font-mono font-bold uppercase py-1.5 px-3 bg-accent-contrast text-accent-contrast-text"
						>
							Manage Keys ({app.apiKeys.configuredCount}/4)
						</button>
					</div>

					<!-- Embedded Full Security Mode Control Panel -->
					<SecurityModeControl />
				</div>
			{/if}

			<!-- TAB 4: PDF & EXTRACTION ENGINE -->
			{#if activeTab === 'pdf'}
				<div class="neo-box p-4 sm:p-6 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] space-y-6">
					<div class="border-b-2 border-border-color pb-3">
						<h2 class="font-sans text-lg font-extrabold uppercase tracking-tight">
							PDF Extraction & Math Engine
						</h2>
						<p class="font-mono text-xs text-text-muted">
							MuPDF WebAssembly scale, asset retention, and mathematical formula rendering
						</p>
					</div>

					<div class="space-y-5">
						<!-- Render Scale (Synchronized with app.selectedScale) -->
						<div class="space-y-2">
							<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
								Default MuPDF Extraction Scale
							</span>
							<p class="font-mono text-xs text-text-muted">
								Controls the resolution at which PDF pages and embedded diagrams are rasterized. Higher scales increase clarity for dense mathematical symbols at the cost of processing memory.
							</p>

							<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
								{#each [1.0, 1.25, 1.5, 2.0] as scale}
									<button
										type="button"
										onclick={() => app.setScale(scale)}
										class="p-3 border-2 font-mono text-xs font-bold uppercase transition-all text-center {app.selectedScale === scale
											? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)]'
											: 'bg-surface hover:bg-muted/50 border-border-color text-text-primary'}"
									>
										<div class="text-sm">{scale}x</div>
										<div class="text-[10px] opacity-80 mt-0.5">
											{scale === 1.0 ? 'Fastest' : scale === 1.25 ? 'Default' : scale === 1.5 ? 'Sharp' : 'Ultra-Dense'}
										</div>
									</button>
								{/each}
							</div>
						</div>

						<!-- Canvas Page Asset Retention -->
						<div class="pt-4 border-t border-border-color/40 flex items-start justify-between gap-4">
							<div class="space-y-1">
								<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
									Auto-Purge Page Background Canvases
								</span>
								<p class="font-mono text-xs text-text-muted leading-relaxed">
									When enabled, full-page background images (5–20 MB per paper) are deleted from local storage after questions are generated. Cropped diagram figures are always safely retained.
								</p>
							</div>

							<label class="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
								<input
									type="checkbox"
									checked={app.settings.autoPurgePageCanvases}
									onchange={(e) => app.settings.setAutoPurgePageCanvases(e.currentTarget.checked)}
									class="sr-only peer"
								/>
								<div class="w-9 h-5 bg-muted border-2 border-border-color peer-focus:outline-hidden peer-checked:bg-accent-contrast transition-colors shadow-[1px_1px_0px_var(--shadow-color)]"></div>
								<div class="absolute left-0.5 top-0.5 bg-surface border-2 border-border-color w-4 h-4 transition-transform peer-checked:translate-x-4"></div>
							</label>
						</div>

						<!-- KaTeX Font Sizing -->
						<div class="pt-4 border-t border-border-color/40 space-y-2">
							<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
								KaTeX Math Display Size
							</span>
							<div class="inline-flex border-2 border-border-color bg-surface shadow-[2px_2px_0px_var(--shadow-color)]">
								{#each (['standard', 'large', 'extra-large'] as KatexFontSize[]) as size}
									<button
										type="button"
										onclick={() => app.settings.setKatexFontSize(size)}
										class="px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors {app.settings.katexFontSize === size
											? 'bg-accent-contrast text-accent-contrast-text'
											: 'text-text-muted hover:text-text-primary hover:bg-muted'}"
									>
										{size}
									</button>
								{/each}
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- TAB 5: EXAM & GRADING WITH LIVE MINI PREVIEW -->
			{#if activeTab === 'exam'}
				<div class="neo-box p-4 sm:p-6 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] space-y-6">
					<div class="border-b-2 border-border-color pb-3">
						<h2 class="font-sans text-lg font-extrabold uppercase tracking-tight">
							Exam Taking & Grading Experience
						</h2>
						<p class="font-mono text-xs text-text-muted">
							Configure test player layout, instant vs. masked feedback, and scoring rules
						</p>
					</div>

					<!-- Settings Controls Form -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<!-- View Mode -->
						<div class="space-y-1.5">
							<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
								Exam View Layout
							</span>
							<div class="grid grid-cols-2 gap-2">
								<button
									type="button"
									onclick={() => app.settings.setExamViewMode('focus')}
									class="p-2 border-2 font-mono text-xs font-bold uppercase text-center {app.settings.examViewMode === 'focus'
										? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)]'
										: 'bg-surface hover:bg-muted border-border-color text-text-primary'}"
								>
									Single Focus
								</button>
								<button
									type="button"
									onclick={() => app.settings.setExamViewMode('paper')}
									class="p-2 border-2 font-mono text-xs font-bold uppercase text-center {app.settings.examViewMode === 'paper'
										? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)]'
										: 'bg-surface hover:bg-muted border-border-color text-text-primary'}"
								>
									Full Paper
								</button>
							</div>
						</div>

						<!-- Evaluation Mode -->
						<div class="space-y-1.5">
							<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
								Evaluation & Feedback
							</span>
							<div class="grid grid-cols-2 gap-2">
								<button
									type="button"
									onclick={() => app.settings.setEvaluationMode('exam')}
									class="p-2 border-2 font-mono text-xs font-bold uppercase text-center {app.settings.evaluationMode === 'exam'
										? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)]'
										: 'bg-surface hover:bg-muted border-border-color text-text-primary'}"
								>
									Exam Mode
								</button>
								<button
									type="button"
									onclick={() => app.settings.setEvaluationMode('study')}
									class="p-2 border-2 font-mono text-xs font-bold uppercase text-center {app.settings.evaluationMode === 'study'
										? 'bg-accent-contrast text-accent-contrast-text border-accent-contrast shadow-[2px_2px_0px_var(--shadow-color)]'
										: 'bg-surface hover:bg-muted border-border-color text-text-primary'}"
								>
									Study Mode
								</button>
							</div>
						</div>

						<!-- Positive / Negative Marks -->
						<div class="space-y-1.5">
							<label for="pos-marks" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
								Default Correct Marks
							</label>
							<input
								id="pos-marks"
								type="number"
								min="1"
								max="10"
								step="0.5"
								value={app.settings.defaultPositiveMarks}
								onchange={(e) => app.settings.setDefaultPositiveMarks(Number(e.currentTarget.value))}
								class="neo-input w-full text-xs font-mono py-2"
							/>
						</div>

						<div class="space-y-1.5">
							<label for="neg-marks" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
								Default Negative Penalty
							</label>
							<input
								id="neg-marks"
								type="number"
								min="0"
								max="5"
								step="0.25"
								value={app.settings.defaultNegativeMarks}
								onchange={(e) => app.settings.setDefaultNegativeMarks(Number(e.currentTarget.value))}
								class="neo-input w-full text-xs font-mono py-2"
							/>
						</div>

						<!-- Marking Scheme Presets -->
						<div class="space-y-1.5 sm:col-span-2 pt-1 border-t border-border-color/30">
							<span class="font-mono text-[10px] font-bold uppercase text-text-muted block">
								Marking Scheme Presets:
							</span>
							<div class="flex flex-wrap items-center gap-1.5">
								{#each MARKING_SCHEME_PRESETS as scheme}
									{@const isActive = app.settings.defaultPositiveMarks === scheme.pos && app.settings.defaultNegativeMarks === scheme.neg}
									<button
										type="button"
										onclick={() => app.settings.setDefaultMarks(scheme.pos, scheme.neg)}
										class="font-mono text-[10px] py-1 px-2 border border-border-color transition-colors cursor-pointer {isActive
											? 'bg-accent-contrast text-accent-contrast-text font-bold shadow-[1px_1px_0px_var(--shadow-color)]'
											: 'bg-surface hover:bg-muted text-text-secondary'}"
									>
										{scheme.name} (+{scheme.pos}/-{scheme.neg})
									</button>
								{/each}
							</div>
						</div>
					</div>

					<!-- Interactive Mini Preview Container -->
					<div class="pt-2">
						<ExamModeMiniPreview
							viewMode={app.settings.examViewMode}
							evaluationMode={app.settings.evaluationMode}
							positiveMarks={app.settings.defaultPositiveMarks}
							negativeMarks={app.settings.defaultNegativeMarks}
						/>
					</div>
				</div>
			{/if}

			<!-- TAB 6: DATA & BACKUP -->
			{#if activeTab === 'storage'}
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
								onclick={refreshStorageStats}
								class="font-mono text-[10px] text-accent-contrast hover:underline uppercase font-bold"
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
								onclick={handleExportBackup}
								class="neo-btn w-full mt-2 py-2 px-3 bg-accent-contrast text-accent-contrast-text text-xs font-bold uppercase tracking-wider"
							>
								Download Backup (.json)
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
								onchange={handleImportBackup}
								class="hidden"
							/>
							<button
								type="button"
								onclick={() => fileInputRef?.click()}
								class="neo-btn w-full mt-2 py-2 px-3 bg-surface hover:bg-muted text-text-primary border-2 border-border-color text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_var(--shadow-color)]"
							>
								Select Backup File...
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
							onclick={handleClearDocumentCache}
							class="neo-btn py-1.5 px-3 text-xs font-mono font-bold uppercase bg-surface hover:bg-muted"
						>
							Clear Document Cache
						</button>
					</div>
				</div>
			{/if}

			<!-- TAB 7: APPEARANCE & WORKFLOW -->
			{#if activeTab === 'appearance'}
				<div class="neo-box p-4 sm:p-6 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] space-y-6">
					<div class="border-b-2 border-border-color pb-3">
						<h2 class="font-sans text-lg font-extrabold uppercase tracking-tight">
							Appearance & Application Workflow
						</h2>
						<p class="font-mono text-xs text-text-muted">
							Interface theme, safety prompts, and background queue concurrency
						</p>
					</div>

					<div class="space-y-5">
						<!-- Theme Switcher -->
						<div class="space-y-2">
							<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
								Color Palette & Theme
							</span>
							<div class="inline-flex border-2 border-border-color bg-surface shadow-[2px_2px_0px_var(--shadow-color)]">
								<button
									type="button"
									onclick={() => app.theme.setTheme('light')}
									class="px-4 py-2 font-mono text-xs font-bold uppercase transition-colors {app.theme.theme === 'light'
										? 'bg-accent-contrast text-accent-contrast-text'
										: 'text-text-muted hover:text-text-primary hover:bg-muted'}"
								>
									Light Mode
								</button>
								<button
									type="button"
									onclick={() => app.theme.setTheme('dark')}
									class="px-4 py-2 font-mono text-xs font-bold uppercase transition-colors border-l-2 border-border-color {app.theme.theme === 'dark'
										? 'bg-accent-contrast text-accent-contrast-text'
										: 'text-text-muted hover:text-text-primary hover:bg-muted'}"
								>
									Dark Mode
								</button>
							</div>
						</div>

						<!-- Folder Deletion Confirmation -->
						<div class="pt-4 border-t border-border-color/40 flex items-start justify-between gap-4">
							<div class="space-y-1">
								<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
									Folder Deletion Protection
								</span>
								<p class="font-mono text-xs text-text-muted leading-relaxed">
									When deleting folders containing multiple papers, show an immediate confirmation dialog instead of relying solely on the 8-second undo toast.
								</p>
							</div>

							<label class="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
								<input
									type="checkbox"
									checked={app.confirmFolderDelete}
									onchange={(e) => app.setConfirmFolderDelete(e.currentTarget.checked)}
									class="sr-only peer"
								/>
								<div class="w-9 h-5 bg-muted border-2 border-border-color peer-focus:outline-hidden peer-checked:bg-accent-contrast transition-colors shadow-[1px_1px_0px_var(--shadow-color)]"></div>
								<div class="absolute left-0.5 top-0.5 bg-surface border-2 border-border-color w-4 h-4 transition-transform peer-checked:translate-x-4"></div>
							</label>
						</div>

						<!-- Background Queue Concurrency -->
						<div class="pt-4 border-t border-border-color/40 space-y-2">
							<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
								Generation Queue Concurrency
							</span>
							<p class="font-mono text-xs text-text-muted">
								Maximum number of papers processed in parallel during bulk generation.
							</p>
							<div class="inline-flex border-2 border-border-color bg-surface shadow-[2px_2px_0px_var(--shadow-color)]">
								<button
									type="button"
									onclick={() => app.queue.setConcurrency(1)}
									class="px-4 py-1.5 font-mono text-xs font-bold uppercase transition-colors {app.queue.concurrency === 1
										? 'bg-accent-contrast text-accent-contrast-text'
										: 'text-text-muted hover:text-text-primary hover:bg-muted'}"
								>
									1 Sequential (Recommended)
								</button>
								<button
									type="button"
									onclick={() => app.queue.setConcurrency(2)}
									class="px-4 py-1.5 font-mono text-xs font-bold uppercase transition-colors border-l-2 border-border-color {app.queue.concurrency === 2
										? 'bg-accent-contrast text-accent-contrast-text'
										: 'text-text-muted hover:text-text-primary hover:bg-muted'}"
								>
									2 Parallel
								</button>
							</div>
						</div>

						<!-- Audio Feedback -->
						<div class="pt-4 border-t border-border-color/40 flex items-start justify-between gap-4">
							<div class="space-y-1">
								<span class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block">
									Generation Chime Notifications
								</span>
								<p class="font-mono text-xs text-text-muted leading-relaxed">
									Play a subtle audio chime when background question paper generation completes.
								</p>
							</div>

							<label class="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
								<input
									type="checkbox"
									checked={app.settings.audioFeedback}
									onchange={(e) => app.settings.setAudioFeedback(e.currentTarget.checked)}
									class="sr-only peer"
								/>
								<div class="w-9 h-5 bg-muted border-2 border-border-color peer-focus:outline-hidden peer-checked:bg-accent-contrast transition-colors shadow-[1px_1px_0px_var(--shadow-color)]"></div>
								<div class="absolute left-0.5 top-0.5 bg-surface border-2 border-border-color w-4 h-4 transition-transform peer-checked:translate-x-4"></div>
							</label>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
