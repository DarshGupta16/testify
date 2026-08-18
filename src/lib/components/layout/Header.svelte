<script lang="ts">
import favicon from '$lib/assets/favicon.svg';
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();
</script>

<header class="sticky top-0 z-30 w-full border-b-2 border-border-color bg-surface/90 backdrop-blur-md transition-colors">
	<div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
		<!-- Brand / Logo -->
		<div class="flex items-center gap-3">
			<a
				href="/"
				class="group flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-color"
				aria-label="Testify Home"
			>
				<div class="flex h-9 w-9 items-center justify-center border-2 border-border-color bg-accent-contrast text-accent-contrast-text shadow-[2px_2px_0px_var(--shadow-color)] transition-transform group-hover:-translate-y-0.5 overflow-hidden">
					<img src={favicon} alt="Testify Logo" class="h-full w-full object-cover" />
				</div>
				<span class="font-sans text-xl font-extrabold tracking-tight uppercase">
					Testify
				</span>
			</a>
		</div>

		<!-- Action Controls -->
		<div class="flex items-center gap-2 sm:gap-3">
			<!-- API Keys / Provider Credentials CTA -->
			<button
				type="button"
				onclick={() => app.modals.openApiKeys()}
				class={`neo-btn text-xs py-2 px-3 flex items-center gap-2 ${
					app.apiKeys.hasAnyConfigured ? 'bg-surface' : 'bg-muted/40'
				}`}
				aria-label="Manage AI API Keys"
				title="Manage API keys for OpenAI, Anthropic, Google Gemini, and Groq"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="square"
					class="h-3.5 w-3.5 text-text-primary"
				>
					<path d="M21 2l-2 2m-1.5 1.5L10 13l-4 4-2-2-4 4 3 3 4-4-2-2 7.5-7.5" />
					<circle cx="16.5" cy="7.5" r="2.5" />
				</svg>
				<span class="hidden sm:inline">API Keys</span>

				{#if app.apiKeys.hasAnyConfigured}
					<span class="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/50 leading-none">
						{app.apiKeys.configuredCount}/4
					</span>
				{:else}
					<span class="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/50 leading-none">
						Set Keys
					</span>
				{/if}
			</button>

			<!-- New Test Upload CTA -->
			<button
				type="button"
				onclick={() => app.modals.openUpload()}
				class="neo-btn neo-btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5"
				aria-label="Upload New Test"
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
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
				<span>Upload Test</span>
			</button>

			<!-- Theme Toggle Button -->
			<button
				type="button"
				onclick={() => app.theme.toggleTheme()}
				class="neo-btn text-xs py-2 px-2.5 flex items-center justify-center"
				aria-label="Toggle theme mode"
				title={`Switch to ${app.theme.theme === 'dark' ? 'Light' : 'Dark'} Mode`}
			>
				{#if app.theme.theme === 'dark'}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="square"
						class="h-4 w-4 text-amber-300"
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
						class="h-4 w-4 text-text-primary"
					>
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
					</svg>
				{/if}
			</button>
		</div>
	</div>
</header>
