<script lang="ts">
import ToggleSwitch from '$lib/components/common/ToggleSwitch.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();
</script>

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
				<label for="confirm-folder-delete-toggle" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block cursor-pointer select-none">
					Folder Deletion Protection
				</label>
				<p class="font-mono text-xs text-text-muted leading-relaxed">
					When deleting folders containing multiple papers, show an immediate confirmation dialog instead of relying solely on the 8-second undo toast.
				</p>
			</div>

			<ToggleSwitch
				id="confirm-folder-delete-toggle"
				ariaLabel="Folder Deletion Protection"
				class="shrink-0 mt-1"
				checked={app.confirmFolderDelete}
				onchange={(checked) => app.setConfirmFolderDelete(checked)}
			/>
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
				<label for="audio-feedback-toggle" class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary block cursor-pointer select-none">
					Generation Chime Notifications
				</label>
				<p class="font-mono text-xs text-text-muted leading-relaxed">
					Play a subtle audio chime when background question paper generation completes.
				</p>
			</div>

			<ToggleSwitch
				id="audio-feedback-toggle"
				ariaLabel="Generation Chime Notifications"
				class="shrink-0 mt-1"
				checked={app.settings.audioFeedback}
				onchange={(checked) => app.settings.setAudioFeedback(checked)}
			/>
		</div>
	</div>
</div>
