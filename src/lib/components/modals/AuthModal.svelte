<script lang="ts">
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();

type AuthTab = 'signin' | 'signup' | 'forgot';

let activeTab = $state<AuthTab>('signin');
let email = $state('');
let password = $state('');
let confirmPassword = $state('');
let errorMessage = $state<string | null>(null);
let successMessage = $state<string | null>(null);
let isSubmitting = $state(false);

// Synchronize initial tab from modalStore when modal opens
$effect(() => {
	if (app.modals.isAuthModalOpen) {
		activeTab = app.modals.authModalInitialTab;
		errorMessage = null;
		successMessage = null;
	}
});

function handleClose() {
	app.modals.closeAuth();
	errorMessage = null;
	successMessage = null;
	password = '';
	confirmPassword = '';
}

function handleKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape' && app.modals.isAuthModalOpen) {
		handleClose();
	}
}

async function handleSignIn(e: SubmitEvent) {
	e.preventDefault();
	if (!email.trim() || !password) {
		errorMessage = 'Please enter both email and password.';
		return;
	}

	errorMessage = null;
	isSubmitting = true;
	try {
		const { error } = await app.auth.signInWithPassword(email.trim(), password);
		if (error) {
			errorMessage = error.message;
		} else {
			app.toast.show('Signed in successfully!', 'success');
			handleClose();
		}
	} finally {
		isSubmitting = false;
	}
}

async function handleSignUp(e: SubmitEvent) {
	e.preventDefault();
	if (!email.trim() || !password) {
		errorMessage = 'Please fill out all required fields.';
		return;
	}
	if (password.length < 6) {
		errorMessage = 'Password must be at least 6 characters.';
		return;
	}
	if (password !== confirmPassword) {
		errorMessage = 'Passwords do not match.';
		return;
	}

	errorMessage = null;
	isSubmitting = true;
	try {
		const { error } = await app.auth.signUp(email.trim(), password);
		if (error) {
			errorMessage = error.message;
		} else {
			successMessage = 'Account created! Please check your email inbox to confirm your address.';
			app.toast.show('Confirmation email sent.', 'info');
		}
	} finally {
		isSubmitting = false;
	}
}

async function handleForgotPassword(e: SubmitEvent) {
	e.preventDefault();
	if (!email.trim()) {
		errorMessage = 'Please enter your email address.';
		return;
	}

	errorMessage = null;
	isSubmitting = true;
	try {
		const { error } = await app.auth.resetPassword(email.trim());
		if (error) {
			errorMessage = error.message;
		} else {
			successMessage = 'Password reset instructions have been sent to your email.';
		}
	} finally {
		isSubmitting = false;
	}
}

async function handleOAuth(provider: 'google' | 'github') {
	errorMessage = null;
	const { error } = await app.auth.signInWithOAuth(provider);
	if (error) {
		errorMessage = error.message;
	}
}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if app.modals.isAuthModalOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="auth-modal-title"
	>
		<!-- Backdrop -->
		<button
			type="button"
			class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-default"
			onclick={handleClose}
			aria-label="Close modal background"
		></button>

		<!-- Modal Dialog -->
		<div
			class="neo-box-lg relative z-10 flex max-h-[94vh] w-full max-w-md flex-col bg-surface border-2 border-border-color shadow-[6px_6px_0px_var(--shadow-color)] animate-slide-down overflow-hidden"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b-2 border-border-color bg-surface px-4 py-3.5 sm:px-6 sm:py-4"
			>
				<div class="flex items-center gap-2.5 sm:gap-3">
					<div
						class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center border-2 border-border-color bg-accent-contrast text-accent-contrast-text shadow-[2px_2px_0px_var(--shadow-color)] shrink-0"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="square"
							class="h-4 w-4 sm:h-5 sm:w-5"
						>
							<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
							<circle cx="12" cy="7" r="4" />
						</svg>
					</div>
					<div>
						<h2
							id="auth-modal-title"
							class="font-sans text-base sm:text-lg font-extrabold uppercase tracking-tight"
						>
							{activeTab === 'signin' ? 'Sign In' : activeTab === 'signup' ? 'Create Account' : 'Reset Password'}
						</h2>
						<p class="font-mono text-xs text-text-muted">
							Cross-device sync & cloud backup
						</p>
					</div>
				</div>

				<button
					type="button"
					onclick={handleClose}
					class="neo-btn p-1.5 sm:p-2 text-text-muted hover:text-text-primary"
					aria-label="Close Auth Modal"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="square"
						class="h-4 w-4"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<!-- Tab Navigation Switcher -->
			<div class="grid grid-cols-2 border-b-2 border-border-color bg-muted/30">
				<button
					type="button"
					onclick={() => {
						activeTab = 'signin';
						errorMessage = null;
						successMessage = null;
					}}
					class={`py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors border-r-2 border-border-color ${
						activeTab === 'signin'
							? 'bg-surface text-accent-contrast border-b-2 border-b-accent-contrast -mb-[2px]'
							: 'text-text-muted hover:text-text-primary'
					}`}
				>
					Sign In
				</button>
				<button
					type="button"
					onclick={() => {
						activeTab = 'signup';
						errorMessage = null;
						successMessage = null;
					}}
					class={`py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
						activeTab === 'signup'
							? 'bg-surface text-accent-contrast border-b-2 border-b-accent-contrast -mb-[2px]'
							: 'text-text-muted hover:text-text-primary'
					}`}
				>
					Sign Up
				</button>
			</div>

			<!-- Modal Body (Scrollable) -->
			<div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
				<!-- Error / Success Notices -->
				{#if errorMessage}
					<div
						class="neo-box p-3 bg-rose-500/10 border-2 border-rose-500 text-rose-600 dark:text-rose-400 font-mono text-xs flex items-start gap-2"
					>
						<span class="font-bold">✕</span>
						<p class="leading-relaxed">{errorMessage}</p>
					</div>
				{/if}

				{#if successMessage}
					<div
						class="neo-box p-3 bg-emerald-500/10 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-mono text-xs flex items-start gap-2"
					>
						<span class="font-bold">✓</span>
						<p class="leading-relaxed">{successMessage}</p>
					</div>
				{/if}

				<!-- OAuth Social Providers -->
				{#if activeTab !== 'forgot'}
					<div class="grid grid-cols-2 gap-2.5">
						<button
							type="button"
							onclick={() => handleOAuth('google')}
							disabled={isSubmitting}
							class="neo-btn py-2 px-3 flex items-center justify-center gap-2 bg-surface hover:bg-muted text-text-primary text-xs font-bold uppercase tracking-wider border-2 border-border-color shadow-[2px_2px_0px_var(--shadow-color)]"
						>
							<svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24">
								<path
									fill="#4285F4"
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
								/>
								<path
									fill="#34A853"
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
								/>
								<path
									fill="#FBBC05"
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
								/>
								<path
									fill="#EA4335"
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
								/>
							</svg>
							<span>Google</span>
						</button>

						<button
							type="button"
							onclick={() => handleOAuth('github')}
							disabled={isSubmitting}
							class="neo-btn py-2 px-3 flex items-center justify-center gap-2 bg-surface hover:bg-muted text-text-primary text-xs font-bold uppercase tracking-wider border-2 border-border-color shadow-[2px_2px_0px_var(--shadow-color)]"
						>
							<svg class="h-3.5 w-3.5 shrink-0 fill-current" viewBox="0 0 24 24">
								<path
									d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
								/>
							</svg>
							<span>GitHub</span>
						</button>
					</div>

					<div class="relative flex items-center justify-center my-2">
						<div class="w-full border-t border-border-color"></div>
						<span
							class="absolute bg-surface px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-text-muted"
						>
							or with email
						</span>
					</div>
				{/if}

				<!-- Sign In Form -->
				{#if activeTab === 'signin'}
					<form onsubmit={handleSignIn} class="space-y-3.5">
						<div>
							<label
								for="signin-email"
								class="block font-mono text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1"
							>
								Email Address
							</label>
							<input
								id="signin-email"
								type="email"
								bind:value={email}
								required
								placeholder="name@example.com"
								autocomplete="email"
								class="w-full border-2 border-border-color bg-surface px-3 py-2 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-accent-contrast focus:outline-hidden shadow-[2px_2px_0px_var(--shadow-color)]"
							/>
						</div>

						<div>
							<div class="flex items-center justify-between mb-1">
								<label
									for="signin-password"
									class="block font-mono text-[11px] font-bold uppercase tracking-wider text-text-secondary"
								>
									Password
								</label>
								<button
									type="button"
									onclick={() => {
										activeTab = 'forgot';
										errorMessage = null;
										successMessage = null;
									}}
									class="font-mono text-[11px] text-accent-contrast hover:underline font-bold"
								>
									Forgot?
								</button>
							</div>
							<input
								id="signin-password"
								type="password"
								bind:value={password}
								required
								placeholder="••••••••"
								autocomplete="current-password"
								class="w-full border-2 border-border-color bg-surface px-3 py-2 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-accent-contrast focus:outline-hidden shadow-[2px_2px_0px_var(--shadow-color)]"
							/>
						</div>

						<button
							type="submit"
							disabled={isSubmitting}
							class="neo-btn w-full py-2.5 bg-accent-contrast text-accent-contrast-text font-bold uppercase tracking-wider text-xs shadow-[3px_3px_0px_var(--shadow-color)] active:translate-x-0.5 active:translate-y-0.5 mt-2 flex items-center justify-center gap-2"
						>
							{#if isSubmitting}
								<span class="inline-block h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
								<span>Signing In...</span>
							{:else}
								<span>Sign In</span>
							{/if}
						</button>
					</form>
				{/if}

				<!-- Sign Up Form -->
				{#if activeTab === 'signup'}
					<form onsubmit={handleSignUp} class="space-y-3.5">
						<div>
							<label
								for="signup-email"
								class="block font-mono text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1"
							>
								Email Address
							</label>
							<input
								id="signup-email"
								type="email"
								bind:value={email}
								required
								placeholder="name@example.com"
								autocomplete="email"
								class="w-full border-2 border-border-color bg-surface px-3 py-2 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-accent-contrast focus:outline-hidden shadow-[2px_2px_0px_var(--shadow-color)]"
							/>
						</div>

						<div>
							<label
								for="signup-password"
								class="block font-mono text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1"
							>
								Password (min 6 characters)
							</label>
							<input
								id="signup-password"
								type="password"
								bind:value={password}
								required
								minlength="6"
								placeholder="••••••••"
								autocomplete="new-password"
								class="w-full border-2 border-border-color bg-surface px-3 py-2 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-accent-contrast focus:outline-hidden shadow-[2px_2px_0px_var(--shadow-color)]"
							/>
						</div>

						<div>
							<label
								for="signup-confirm-password"
								class="block font-mono text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1"
							>
								Confirm Password
							</label>
							<input
								id="signup-confirm-password"
								type="password"
								bind:value={confirmPassword}
								required
								minlength="6"
								placeholder="••••••••"
								autocomplete="new-password"
								class="w-full border-2 border-border-color bg-surface px-3 py-2 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-accent-contrast focus:outline-hidden shadow-[2px_2px_0px_var(--shadow-color)]"
							/>
						</div>

						<button
							type="submit"
							disabled={isSubmitting}
							class="neo-btn w-full py-2.5 bg-accent-contrast text-accent-contrast-text font-bold uppercase tracking-wider text-xs shadow-[3px_3px_0px_var(--shadow-color)] active:translate-x-0.5 active:translate-y-0.5 mt-2 flex items-center justify-center gap-2"
						>
							{#if isSubmitting}
								<span class="inline-block h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
								<span>Creating Account...</span>
							{:else}
								<span>Create Account</span>
							{/if}
						</button>
					</form>
				{/if}

				<!-- Forgot Password Form -->
				{#if activeTab === 'forgot'}
					<form onsubmit={handleForgotPassword} class="space-y-3.5">
						<p class="font-mono text-xs text-text-secondary">
							Enter the email associated with your account and we will send you a password reset link.
						</p>

						<div>
							<label
								for="forgot-email"
								class="block font-mono text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1"
							>
								Email Address
							</label>
							<input
								id="forgot-email"
								type="email"
								bind:value={email}
								required
								placeholder="name@example.com"
								autocomplete="email"
								class="w-full border-2 border-border-color bg-surface px-3 py-2 text-sm font-sans text-text-primary placeholder:text-text-muted focus:border-accent-contrast focus:outline-hidden shadow-[2px_2px_0px_var(--shadow-color)]"
							/>
						</div>

						<button
							type="submit"
							disabled={isSubmitting}
							class="neo-btn w-full py-2.5 bg-accent-contrast text-accent-contrast-text font-bold uppercase tracking-wider text-xs shadow-[3px_3px_0px_var(--shadow-color)] active:translate-x-0.5 active:translate-y-0.5 mt-2 flex items-center justify-center gap-2"
						>
							{#if isSubmitting}
								<span class="inline-block h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
								<span>Sending Link...</span>
							{:else}
								<span>Send Reset Link</span>
							{/if}
						</button>

						<div class="text-center pt-2">
							<button
								type="button"
								onclick={() => {
									activeTab = 'signin';
									errorMessage = null;
									successMessage = null;
								}}
								class="font-mono text-xs text-accent-contrast hover:underline font-bold uppercase tracking-wider"
							>
								← Back to Sign In
							</button>
						</div>
					</form>
				{/if}

				<!-- Offline-first assurance footer note -->
				<div class="neo-box p-3 bg-muted/40 border-2 border-border-color space-y-1">
					<div class="flex items-center gap-1.5 font-mono text-[11px] font-bold text-text-primary">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="square"
							class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
						>
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
							<path d="M7 11V7a5 5 0 0 1 10 0v4" />
						</svg>
						<span>Guest & Local-First Continuity</span>
					</div>
					<p class="font-mono text-[10px] text-text-muted leading-relaxed">
						All assessments and keys stay stored on this device without signing in. Creating an account unlocks automated cloud sync across your phone, tablet, and laptop.
					</p>
				</div>
			</div>
		</div>
	</div>
{/if}
