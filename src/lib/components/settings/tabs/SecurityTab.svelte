<script lang="ts">
import SecurityModeControl from '$lib/components/modals/keys/SecurityModeControl.svelte';
import { getAppContext } from '$lib/stores/appContext.svelte';

const app = getAppContext();
</script>

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
