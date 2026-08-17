<script lang="ts">
import type { SubjectItem } from '$lib/types/subject';

interface Props {
	title: string;
	subjectId: string;
	durationMinutes: number | null;
	description: string;
	subjects: SubjectItem[];
	ontitlechange: (value: string) => void;
	onsubjectchange: (value: string) => void;
	ondurationchange: (value: number | null) => void;
	ondescriptionchange: (value: string) => void;
}

const {
	title,
	subjectId,
	durationMinutes,
	description,
	subjects,
	ontitlechange,
	onsubjectchange,
	ondurationchange,
	ondescriptionchange,
}: Props = $props();

const isUntimed = $derived(durationMinutes === null || durationMinutes === 0);

function handleUntimedToggle(checked: boolean) {
	if (checked) {
		ondurationchange(null);
	} else {
		ondurationchange(60); // Default 60 minutes
	}
}

function handleDurationInput(val: string) {
	const num = Number.parseInt(val, 10);
	if (Number.isNaN(num) || num <= 0) {
		ondurationchange(null);
	} else {
		ondurationchange(num);
	}
}
</script>

<div class="neo-box p-4 sm:p-5 bg-surface space-y-4 border-2 border-border-color">
	<div class="border-b border-border-color/30 pb-2">
		<h3 class="font-mono text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
			<span>📋</span>
			<span>General Test Metadata</span>
		</h3>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<!-- Test Title -->
		<div class="space-y-1.5 md:col-span-2">
			<label for="edit-test-title" class="block font-mono text-xs font-bold uppercase text-text-secondary">
				Test Title <span class="text-rose-500">*</span>
			</label>
			<input
				id="edit-test-title"
				type="text"
				value={title}
				oninput={(e) => ontitlechange(e.currentTarget.value)}
				placeholder="Enter test title..."
				class="neo-input w-full font-bold text-sm"
				required
			/>
		</div>

		<!-- Subject Selection -->
		<div class="space-y-1.5">
			<label for="edit-test-subject" class="block font-mono text-xs font-bold uppercase text-text-secondary">
				Academic Subject <span class="text-rose-500">*</span>
			</label>
			<select
				id="edit-test-subject"
				value={subjectId}
				onchange={(e) => onsubjectchange(e.currentTarget.value)}
				class="neo-input w-full font-mono text-xs cursor-pointer"
			>
				{#each subjects as sub (sub.id)}
					<option value={sub.id}>{sub.name}</option>
				{/each}
			</select>
		</div>

		<!-- Duration Configuration -->
		<div class="space-y-1.5">
			<div class="flex items-center justify-between">
				<label for="edit-test-duration" class="block font-mono text-xs font-bold uppercase text-text-secondary">
					Duration (Minutes)
				</label>
				<label class="flex items-center gap-1.5 font-mono text-xs text-text-muted cursor-pointer">
					<input
						type="checkbox"
						checked={isUntimed}
						onchange={(e) => handleUntimedToggle(e.currentTarget.checked)}
						class="cursor-pointer"
					/>
					<span>Untimed</span>
				</label>
			</div>

			<input
				id="edit-test-duration"
				type="number"
				min="1"
				max="600"
				disabled={isUntimed}
				value={isUntimed ? '' : (durationMinutes ?? 60)}
				oninput={(e) => handleDurationInput(e.currentTarget.value)}
				placeholder={isUntimed ? 'Untimed (No limit)' : 'e.g. 180'}
				class="neo-input w-full font-mono text-xs disabled:opacity-40 disabled:cursor-not-allowed"
			/>
		</div>

		<!-- Description -->
		<div class="space-y-1.5 md:col-span-2">
			<label for="edit-test-desc" class="block font-mono text-xs font-bold uppercase text-text-secondary">
				Description / Notes (Optional)
			</label>
			<textarea
				id="edit-test-desc"
				rows="2"
				value={description}
				oninput={(e) => ondescriptionchange(e.currentTarget.value)}
				placeholder="Add notes, syllabus coverage, or instructions for this assessment..."
				class="neo-input w-full text-xs font-mono resize-none"
			></textarea>
		</div>
	</div>
</div>
