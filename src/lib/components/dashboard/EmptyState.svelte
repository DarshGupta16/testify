<script lang="ts">
import TestUploadForm from '$lib/components/forms/TestUploadForm.svelte';
</script>

<div class="mx-auto max-w-4xl px-3.5 py-6 sm:py-12">
	<!-- Hero Center Header -->
	<div class="text-center mb-6 sm:mb-10">
		<div class="inline-flex items-center gap-2 mb-2.5 sm:mb-3">
			<span class="neo-badge">
				<span class="inline-block h-2 w-2 bg-text-primary"></span>
				STATUS: ZERO ASSESSMENTS FOUND
			</span>
		</div>
		<h1 class="text-2xl sm:text-5xl font-black uppercase tracking-tight text-text-primary">
			No Tests Created Yet
		</h1>
		<p class="mt-2 max-w-xl mx-auto text-xs sm:text-base text-text-secondary">
			Upload your question paper PDF to automatically extract pages, raster images, and vector diagrams with MuPDF.
		</p>
	</div>

	<!-- Direct Upload Card -->
	<div class="neo-box-lg p-4 sm:p-8 bg-surface transition-all">
		<div class="flex items-center gap-2 sm:gap-2.5 border-b-2 border-border-color pb-3 sm:pb-4 mb-4 sm:mb-6">
			<div class="h-3.5 w-3.5 sm:h-4 sm:w-4 bg-accent-contrast"></div>
			<h2 class="text-base sm:text-xl font-extrabold uppercase tracking-wide">
				Convert New Assessment PDF
			</h2>
		</div>

		<!-- Embedded Unified Upload Form -->
		<TestUploadForm />
	</div>
</div>
