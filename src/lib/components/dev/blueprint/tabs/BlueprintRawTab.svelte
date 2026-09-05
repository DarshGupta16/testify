<script lang="ts">
import type { PaperBlueprint } from '$lib/types/blueprint';

let { blueprint }: { blueprint: PaperBlueprint } = $props();
</script>

<div class="relative neo-box p-3 bg-muted/30 border-2 border-border-color">
	<pre
		class="font-mono text-xs text-text-primary overflow-x-auto p-2 leading-relaxed max-h-[550px]">{JSON.stringify(
			blueprint,
			null,
			2
		)}</pre>
</div>
