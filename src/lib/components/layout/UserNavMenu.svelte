<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

let isUserMenuOpen = $state(false);
let showSignOutConfirm = $state(false);
let menuContainerRef: HTMLDivElement | null = $state(null);

function toggleUserMenu() {
	isUserMenuOpen = !isUserMenuOpen;
	if (!isUserMenuOpen) {
		showSignOutConfirm = false;
	}
}

function closeUserMenu() {
	isUserMenuOpen = false;
	showSignOutConfirm = false;
}

function handleKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape' && isUserMenuOpen) {
		closeUserMenu();
	}
}

function handleWindowPointerDown(event: PointerEvent) {
	if (!isUserMenuOpen) return;
	const target = event.target as Node | null;
	if (menuContainerRef && !menuContainerRef.contains(target)) {
		closeUserMenu();
	}
}

/**
 * Deterministic color palette for user initials badges.
 */
function getAvatarColor(identifier: string): string {
	const colors = [
		'bg-amber-400 text-amber-950 border-amber-600',
		'bg-emerald-400 text-emerald-950 border-emerald-600',
		'bg-sky-400 text-sky-950 border-sky-600',
		'bg-violet-400 text-violet-950 border-violet-600',
		'bg-rose-400 text-rose-950 border-rose-600',
		'bg-orange-400 text-orange-950 border-orange-600',
		'bg-teal-400 text-teal-950 border-teal-600',
		'bg-indigo-400 text-indigo-950 border-indigo-600',
	];
	let hash = 0;
	for (let i = 0; i < identifier.length; i++) {
		hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
	}
	const index = Math.abs(hash) % colors.length;
	return colors[index];
}

/**
 * Extracts 1-2 uppercase initials from user's email or display name.
 */
function getInitials(nameOrEmail?: string | null): string {
	if (!nameOrEmail) return '?';
	const clean = nameOrEmail.trim();
	if (clean.includes('@')) {
		return clean.charAt(0).toUpperCase();
	}
	const parts = clean.split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
	}
	return clean.slice(0, 2).toUpperCase();
}
</script>

<svelte:window onkeydown={handleKeyDown} onpointerdown={handleWindowPointerDown} />

<div class="relative" bind:this={menuContainerRef}>
	<!-- Trigger Button (Avatar + Status Badge) -->
	<button
		type="button"
		onclick={toggleUserMenu}
		class="neo-btn text-[11px] sm:text-xs py-1 px-2 sm:py-1.5 sm:px-3 flex items-center gap-1.5 sm:gap-2 font-mono font-bold whitespace-nowrap bg-surface"
		aria-label="Account Profiles and Cloud Sync"
		aria-expanded={isUserMenuOpen}
	>
		{#if app.auth.isAuthenticated}
			<!-- User Initials Avatar -->
			<div
				class="h-3.5 w-3.5 sm:h-4 sm:w-4 border border-border-color flex items-center justify-center font-mono font-black text-[8px] sm:text-[9px] leading-none shrink-0 shadow-[1px_1px_0px_var(--shadow-color)] {getAvatarColor(app.auth.userEmail)}"
			>
				{getInitials(app.auth.userEmail)}
			</div>
			<span class="hidden md:inline max-w-[120px] truncate text-text-primary text-left">
				{app.auth.userEmail}
			</span>
		{:else}
			<!-- Guest Outline Avatar -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="square"
				class="h-3 w-3 sm:h-3.5 sm:w-3.5 text-text-muted shrink-0"
			>
				<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
				<circle cx="12" cy="7" r="4" />
			</svg>
			<span class="hidden md:inline text-text-muted">Guest</span>
		{/if}

		<!-- Sync Dot Indicator -->
		{#if app.auth.syncStatus === 'syncing'}
			<span
				class="inline-block h-2 w-2 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0"
				title="Syncing with cloud"
			></span>
		{:else if app.auth.syncStatus === 'synced'}
			<span class="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981] shrink-0" title="Cloud Synced"></span>
		{:else if app.auth.syncStatus === 'error'}
			<span class="h-2 w-2 rounded-full bg-rose-500 shrink-0" title="Sync Error"></span>
		{:else}
			<span class="h-2 w-2 rounded-full bg-amber-500 shrink-0" title="Offline / Local Only"></span>
		{/if}

		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			class="h-3 w-3 text-text-muted shrink-0"
		>
			<path d="M6 9l6 6 6-6" />
		</svg>
	</button>

	<!-- User Menu Dropdown -->
	{#if isUserMenuOpen}
		<button
			type="button"
			tabindex="-1"
			aria-hidden="true"
			class="fixed inset-0 z-40 cursor-default bg-transparent"
			onclick={closeUserMenu}
		></button>

		<div
			class="neo-box absolute right-0 mt-2 z-50 w-72 sm:w-80 bg-surface border-2 border-border-color shadow-[4px_4px_0px_var(--shadow-color)] p-3 space-y-3 font-mono animate-slide-down"
		>
			<!-- 1. Active Account Card -->
			<div
				class="p-2.5 border-2 border-border-color bg-surface-secondary/40 shadow-[2px_2px_0px_var(--shadow-color)] space-y-2"
			>
				<div class="flex items-center gap-2.5">
					{#if app.auth.isAuthenticated}
						<div
							class="h-8 w-8 border-2 flex items-center justify-center font-mono font-black text-sm shrink-0 shadow-[1px_1px_0px_var(--shadow-color)] {getAvatarColor(app.auth.userEmail)}"
						>
							{getInitials(app.auth.userEmail)}
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-center justify-between gap-1">
								<span
									class="font-mono text-xs font-bold text-text-primary truncate block"
									title={app.auth.userEmail}
								>
									{app.auth.userEmail}
								</span>
								<span
									class="font-mono text-[9px] font-black uppercase px-1.5 py-0.5 border border-border-color bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0"
								>
									Active
								</span>
							</div>
							<span class="text-[10px] text-text-muted block truncate">
								Supabase Cloud Partition
							</span>
						</div>
					{:else}
						<div
							class="h-8 w-8 border-2 border-border-color bg-muted flex items-center justify-center text-text-muted shrink-0 shadow-[1px_1px_0px_var(--shadow-color)]"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								class="h-4 w-4"
							>
								<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
								<circle cx="12" cy="7" r="4" />
							</svg>
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-center justify-between gap-1">
								<span class="font-mono text-xs font-bold text-text-primary">
									Guest Profile
								</span>
								<span
									class="font-mono text-[9px] font-black uppercase px-1.5 py-0.5 border border-border-color bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0"
								>
									Active
								</span>
							</div>
							<span class="text-[10px] text-text-muted block">
								Local storage only • No sync
							</span>
						</div>
					{/if}
				</div>

				<!-- Cloud Sync Status Line -->
				<div class="flex items-center justify-between text-[11px] pt-1 border-t border-border-color/40">
					<span class="text-text-muted">Cloud Sync:</span>
					<span
						class="font-bold uppercase flex items-center gap-1 {app.auth.syncStatus === 'synced'
							? 'text-emerald-600 dark:text-emerald-400'
							: app.auth.syncStatus === 'syncing'
								? 'text-blue-500'
								: app.auth.syncStatus === 'error'
									? 'text-rose-500'
									: 'text-amber-500'}"
					>
						{#if app.auth.syncStatus === 'syncing'}
							<span class="inline-block h-2 w-2 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
						{:else if app.auth.syncStatus === 'synced'}
							<span>●</span>
						{/if}
						{app.auth.syncStatus}
					</span>
				</div>
			</div>

			<!-- 2. Switch Profile Section -->
			<div class="space-y-1.5">
				<div class="flex items-center justify-between border-b-2 border-border-color pb-1">
					<span class="text-[10px] font-black uppercase tracking-wider text-text-muted">
						Switch Profile
					</span>
					<span class="text-[9px] text-text-muted">
						{app.auth.savedAccounts.length} saved
					</span>
				</div>

				<div class="space-y-1 max-h-48 overflow-y-auto pr-0.5">
					<!-- Saved Accounts List -->
					{#each app.auth.savedAccounts as acc (acc.userId)}
						{@const isActive = app.auth.user?.id === acc.userId}
						{#if isActive}
							<!-- Currently Active Account -->
							<div
								class="w-full flex items-center justify-between p-1.5 border-2 border-border-color bg-primary/10 shadow-[1px_1px_0px_var(--shadow-color)]"
							>
								<div class="flex items-center gap-2 min-w-0">
									<div
										class="h-5 w-5 border flex items-center justify-center text-[10px] font-bold shrink-0 {getAvatarColor(acc.email)}"
									>
										{getInitials(acc.email)}
									</div>
									<span class="text-xs font-bold truncate text-text-primary">
										{acc.email}
									</span>
								</div>
								<span class="text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400 shrink-0">
									Current
								</span>
							</div>
						{:else}
							<!-- 1-Click Instant Profile Switch -->
							<button
								type="button"
								onclick={async () => {
									closeUserMenu();
									await app.auth.switchAccount(acc.userId);
								}}
								class="w-full flex items-center justify-between p-1.5 border-2 border-border-color/60 hover:border-border-color hover:bg-muted text-left transition-all group"
								title={`Switch to ${acc.email}`}
							>
								<div class="flex items-center gap-2 min-w-0">
									<div
										class="h-5 w-5 border flex items-center justify-center text-[10px] font-bold shrink-0 {getAvatarColor(acc.email)}"
									>
										{getInitials(acc.email)}
									</div>
									<span class="text-xs truncate text-text-primary group-hover:font-bold">
										{acc.email}
									</span>
								</div>
								<span class="text-[10px] uppercase font-bold text-text-muted group-hover:text-primary shrink-0">
									Switch →
								</span>
							</button>
						{/if}
					{/each}

					<!-- Guest Profile Option -->
					{#if !app.auth.isAuthenticated}
						<div
							class="w-full flex items-center justify-between p-1.5 border-2 border-border-color bg-amber-500/10 shadow-[1px_1px_0px_var(--shadow-color)]"
						>
							<div class="flex items-center gap-2 min-w-0">
								<div
									class="h-5 w-5 border border-border-color bg-muted flex items-center justify-center text-text-muted shrink-0"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										class="h-3 w-3"
									>
										<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
										<circle cx="12" cy="7" r="4" />
									</svg>
								</div>
								<span class="text-xs font-bold truncate text-text-primary">
									Guest Profile
								</span>
							</div>
							<span class="text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400 shrink-0">
								Current
							</span>
						</div>
					{:else}
						<button
							type="button"
							onclick={async () => {
								closeUserMenu();
								await app.auth.switchToGuest();
							}}
							class="w-full flex items-center justify-between p-1.5 border-2 border-dashed border-border-color/60 hover:border-border-color hover:border-solid hover:bg-muted text-left transition-all group"
							title="Switch to local Guest profile"
						>
							<div class="flex items-center gap-2 min-w-0">
								<div
									class="h-5 w-5 border border-border-color bg-muted flex items-center justify-center text-text-muted shrink-0"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										class="h-3 w-3"
									>
										<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
										<circle cx="12" cy="7" r="4" />
									</svg>
								</div>
								<span class="text-xs truncate text-text-primary group-hover:font-bold">
									Guest Profile
								</span>
							</div>
							<span class="text-[10px] uppercase font-bold text-text-muted group-hover:text-primary shrink-0">
								Switch →
							</span>
						</button>
					{/if}
				</div>
			</div>

			<!-- 3. Actions Toolbar (2 Rows of 3 Buttons) -->
			<div class="space-y-2 pt-1 border-t-2 border-border-color">
				<div class="grid grid-cols-3 gap-2 w-full">
					<!-- 1. Add Another Account Button -->
					<button
						type="button"
						onclick={() => {
							closeUserMenu();
							app.modals.openAuth('signin');
						}}
						class="neo-btn h-11 !p-0 flex items-center justify-center bg-surface hover:bg-muted text-text-primary border-2 border-border-color shadow-[2px_2px_0px_var(--shadow-color)] cursor-pointer"
						title="Add Another Account"
						aria-label="Add Another Account"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="h-4.5 w-4.5"
						>
							<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
							<circle cx="9" cy="7" r="4" />
							<line x1="19" y1="8" x2="19" y2="14" />
							<line x1="22" y1="11" x2="16" y2="11" />
						</svg>
					</button>

					<!-- 2. Cloud Sync Button -->
					{#if app.auth.isAuthenticated}
						<button
							type="button"
							disabled={app.auth.syncStatus === 'syncing'}
							onclick={async () => {
								await app.auth.syncNow();
							}}
							class="neo-btn h-11 !p-0 flex items-center justify-center bg-surface hover:bg-muted text-text-primary border-2 border-border-color shadow-[2px_2px_0px_var(--shadow-color)] disabled:opacity-50 cursor-pointer"
							title={app.auth.syncStatus === 'syncing' ? 'Syncing...' : 'Sync Cloud Now'}
							aria-label="Sync Cloud Now"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="h-4.5 w-4.5 {app.auth.syncStatus === 'syncing' ? 'animate-spin text-blue-500' : ''}"
							>
								<path d="m17 18-1.535 1.605a5 5 0 0 1-8-1.5" />
								<path d="M17 22v-4h-4" />
								<path d="M20.996 15.251A4.5 4.5 0 0 0 17.495 8h-1.79a7 7 0 1 0-12.709 5.607" />
								<path d="M7 10v4h4" />
								<path d="m7 14 1.535-1.605a5 5 0 0 1 8 1.5" />
							</svg>
						</button>
					{:else}
						<button
							type="button"
							onclick={() => {
								closeUserMenu();
								app.modals.openAuth('signin');
							}}
							class="neo-btn h-11 !p-0 flex items-center justify-center bg-surface hover:bg-muted text-text-muted hover:text-text-primary border-2 border-border-color shadow-[2px_2px_0px_var(--shadow-color)] cursor-pointer"
							title="Sign in to sync with cloud"
							aria-label="Sign in to sync with cloud"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="h-4.5 w-4.5 opacity-60"
							>
								<path d="m17 18-1.535 1.605a5 5 0 0 1-8-1.5" />
								<path d="M17 22v-4h-4" />
								<path d="M20.996 15.251A4.5 4.5 0 0 0 17.495 8h-1.79a7 7 0 1 0-12.709 5.607" />
								<path d="M7 10v4h4" />
								<path d="m7 14 1.535-1.605a5 5 0 0 1 8 1.5" />
							</svg>
						</button>
					{/if}

					<!-- 3. Theme Toggle Button -->
					<button
						type="button"
						onclick={() => app.theme.toggleTheme()}
						class="neo-btn h-11 !p-0 flex items-center justify-center bg-surface hover:bg-muted text-text-primary border-2 border-border-color shadow-[2px_2px_0px_var(--shadow-color)] cursor-pointer"
						title={`Switch to ${app.theme.theme === 'dark' ? 'Light' : 'Dark'} Mode`}
						aria-label="Toggle theme mode"
					>
						{#if app.theme.theme === 'dark'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="square"
								class="h-4.5 w-4.5 text-amber-300"
							>
								<circle cx="12" cy="12" r="5" />
								<line x1="12" y1="1" x2="12" y2="3" />
								<line x1="12" y1="21" x2="12" y2="23" />
								<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
								<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
								<line x1="1" y1="12" x2="3" y2="12" />
								<line x1="21" y1="12" x2="23" y2="12" />
								<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
								<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
							</svg>
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="square"
								class="h-4.5 w-4.5 text-text-primary"
							>
								<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
							</svg>
						{/if}
					</button>

					<!-- 4. API Keys Trigger -->
					<button
						type="button"
						onclick={() => {
							closeUserMenu();
							app.modals.openApiKeys();
						}}
						class="neo-btn h-11 !p-0 flex items-center justify-center bg-surface hover:bg-muted text-text-primary border-2 border-border-color shadow-[2px_2px_0px_var(--shadow-color)] relative cursor-pointer"
						title={`Manage AI API Keys (${app.apiKeys.configuredCount}/4 configured)`}
						aria-label="Manage AI API Keys"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="square"
							class="h-4.5 w-4.5"
						>
							<path d="M21 2l-2 2m-1.5 1.5L10 13l-4 4-2-2-4 4 3 3 4-4-2-2 7.5-7.5" />
							<circle cx="16.5" cy="7.5" r="2.5" />
						</svg>
						{#if app.apiKeys.hasAnyConfigured}
							<span
								class="absolute -top-1 -right-1 font-mono text-[8px] font-bold px-1 bg-emerald-500 text-black leading-tight border border-border-color"
							>
								{app.apiKeys.configuredCount}
							</span>
						{/if}
					</button>

					<!-- 5. Settings Direct Link -->
					<a
						href="/settings"
						onclick={closeUserMenu}
						class="neo-btn h-11 !p-0 flex items-center justify-center bg-surface hover:bg-muted text-text-primary border-2 border-border-color shadow-[2px_2px_0px_var(--shadow-color)] cursor-pointer"
						title="Application Settings & Preferences"
						aria-label="Application Settings & Preferences"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							class="h-4.5 w-4.5"
						>
							<circle cx="12" cy="12" r="3" />
							<path
								d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
							/>
						</svg>
					</a>

					<!-- 6. Sign Out / Sign In Button -->
					{#if app.auth.isAuthenticated}
						<button
							type="button"
							onclick={() => {
								showSignOutConfirm = !showSignOutConfirm;
							}}
							class={`neo-btn h-11 !p-0 flex items-center justify-center border-2 shadow-[2px_2px_0px_var(--shadow-color)] cursor-pointer ${
								showSignOutConfirm
									? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500'
									: 'bg-surface hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-border-color hover:border-rose-500/50'
							}`}
							title="Sign Out Options"
							aria-label="Sign Out"
							aria-expanded={showSignOutConfirm}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								class="h-4.5 w-4.5"
							>
								<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
								<polyline points="16 17 21 12 16 7" />
								<line x1="21" y1="12" x2="9" y2="12" />
							</svg>
						</button>
					{:else}
						<button
							type="button"
							onclick={() => {
								closeUserMenu();
								app.modals.openAuth('signin');
							}}
							class="neo-btn h-11 !p-0 flex items-center justify-center bg-surface hover:bg-muted text-emerald-600 dark:text-emerald-400 border-2 border-border-color shadow-[2px_2px_0px_var(--shadow-color)] cursor-pointer"
							title="Sign in or register"
							aria-label="Sign in or register"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								class="h-4.5 w-4.5"
							>
								<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
								<polyline points="10 17 15 12 10 7" />
								<line x1="15" y1="12" x2="3" y2="12" />
							</svg>
						</button>
					{/if}
				</div>

				<!-- 4. Sign Out Confirmation Drawer -->
				{#if app.auth.isAuthenticated && showSignOutConfirm}
					<div
						class="p-2 border-2 border-rose-500/60 bg-rose-500/5 space-y-2 shadow-[2px_2px_0px_var(--shadow-color)]"
					>
						<div class="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								class="h-3 w-3"
							>
								<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
								<line x1="12" y1="9" x2="12" y2="13" />
								<line x1="12" y1="17" x2="12.01" y2="17" />
							</svg>
							<span>Sign Out Confirmation</span>
						</div>

						<!-- Option A: Wipe from device (Public Computers) -->
						<button
							type="button"
							onclick={async () => {
								closeUserMenu();
								await app.auth.signOut({ wipeLocalData: true });
							}}
							class="neo-btn w-full p-2 text-left bg-rose-600 text-white hover:bg-rose-700 border-2 border-rose-800 shadow-[2px_2px_0px_var(--shadow-color)]"
						>
							<div class="text-[11px] font-black uppercase flex items-center justify-between">
								<span>Sign Out & Wipe Partition</span>
								<span class="text-[9px] bg-rose-900 px-1 py-0.5 uppercase">Public PC</span>
							</div>
							<p class="text-[9px] text-rose-100/90 leading-tight mt-0.5 normal-case font-mono">
								Deletes local papers & tokens from this device. Cloud papers remain safe.
							</p>
						</button>

						<!-- Option B: Keep local papers (Family / Personal Computer) -->
						<button
							type="button"
							onclick={async () => {
								closeUserMenu();
								await app.auth.signOut({ wipeLocalData: false });
							}}
							class="neo-btn w-full p-2 text-left bg-surface hover:bg-muted text-text-primary border-2 border-border-color shadow-[2px_2px_0px_var(--shadow-color)]"
						>
							<div class="text-[11px] font-black uppercase flex items-center justify-between">
								<span>Sign Out (Keep Papers)</span>
								<span class="text-[9px] bg-muted px-1 py-0.5 uppercase text-text-muted">Personal PC</span>
							</div>
							<p class="text-[9px] text-text-muted leading-tight mt-0.5 normal-case font-mono">
								Retains local assessments on this device. Switches to Guest profile.
							</p>
						</button>

						<!-- Cancel -->
						<button
							type="button"
							onclick={() => {
								showSignOutConfirm = false;
							}}
							class="w-full text-center text-[10px] text-text-muted hover:text-text-primary hover:underline font-bold uppercase py-0.5"
						>
							Cancel
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
