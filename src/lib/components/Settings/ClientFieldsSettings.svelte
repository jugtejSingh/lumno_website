<script lang="ts">
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import InfoTip from '$lib/components/utils/InfoTip.svelte';
	import { MAX_CLIENT_FIELD_HEADINGS, type ClientFieldHeading } from '$lib/types/clientFields';

	// Posted as parallel clientFieldHeadingId / clientFieldHeadingLabel lists inside the
	// settings page's single save form (see parseClientFieldHeadings).
	let { headings = $bindable([]) }: { headings?: ClientFieldHeading[] } = $props();

	const atLimit = $derived(headings.length >= MAX_CLIENT_FIELD_HEADINGS);

	function addHeading() {
		if (atLimit) {
			return;
		}
		// minted here, not on the server, so the id on screen after saving is the stored one
		headings = [...headings, { id: crypto.randomUUID(), label: '' }];
	}

	function removeHeading(id: string) {
		headings = headings.filter((heading) => heading.id !== id);
	}

	function moveHeading(index: number, offset: number) {
		const target = index + offset;
		if (target < 0 || target >= headings.length) {
			return;
		}
		const next = [...headings];
		const moved = next[index];
		next[index] = next[target];
		next[target] = moved;
		headings = next;
	}
</script>

<div class="section">
	<div class="section-title">
		Client Profile Fields<InfoTip
			label="Client Profile Fields"
			text="Headings you want on every client's profile, like Presenting Concerns or Medication. Each one becomes an optional notes box when you add or edit a client. Clients never see these. Removing a heading hides its notes but doesn't delete them."
		/>
	</div>

	<div class="helper">
		No need to add headings for phone, location (city/town, state, country), age or gender. Clients
		fill those in themselves when they accept your invite, and you'll see them on their profile.
	</div>

	{#each headings as heading, index (heading.id)}
		<div class="heading-row">
			<input type="hidden" name="clientFieldHeadingId" value={heading.id} />
			<div class="heading-input">
				<Input
					name="clientFieldHeadingLabel"
					placeholder="e.g. Presenting concerns"
					bind:value={heading.label}
				/>
			</div>
			<div class="heading-actions">
				<button
					type="button"
					class="icon-btn"
					aria-label="Move {heading.label || 'heading'} up"
					disabled={index === 0}
					onclick={() => moveHeading(index, -1)}>↑</button
				>
				<button
					type="button"
					class="icon-btn"
					aria-label="Move {heading.label || 'heading'} down"
					disabled={index === headings.length - 1}
					onclick={() => moveHeading(index, 1)}>↓</button
				>
				<button
					type="button"
					class="icon-btn"
					aria-label="Remove {heading.label || 'heading'}"
					onclick={() => removeHeading(heading.id)}>✕</button
				>
			</div>
		</div>
	{:else}
		<div class="helper">No headings yet. Add the things you want to note about every client.</div>
	{/each}

	{#if atLimit}
		<div class="helper">You've reached the limit of {MAX_CLIENT_FIELD_HEADINGS} headings.</div>
	{:else}
		<div>
			<Button variant="secondary" size="sm" onclick={addHeading}>Add heading</Button>
		</div>
	{/if}
</div>

<style>
	.section {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.section-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.helper {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.heading-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.heading-input {
		flex: 1;
		min-width: 0;
	}

	.heading-actions {
		display: flex;
		gap: 4px;
	}

	.icon-btn {
		width: 32px;
		height: 32px;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
		color: var(--text-secondary);
		font-size: 14px;
		cursor: pointer;
	}

	.icon-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
