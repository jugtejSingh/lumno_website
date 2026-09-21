<script lang="ts">
	import Input from '$lib/components/utils/Input.svelte';
	import Select from '$lib/components/utils/Select.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';
	import ClientCustomFields from '$lib/components/Clients/ClientCustomFields.svelte';
	import type { ClientFieldHeading, ClientFieldValues } from '$lib/types/clientFields';

	let {
		name = $bindable(''),
		email = $bindable(''),
		rate = $bindable(''),
		tags = $bindable([]),
		status = $bindable(''),
		customFields = $bindable({}),
		fieldHeadings = [],
		showEmail = true,
		showDetails = true,
		statusOptions,
		errors = {}
	}: {
		name?: string;
		email?: string;
		rate?: string;
		tags?: string[];
		status?: string;
		customFields?: ClientFieldValues;
		fieldHeadings?: ClientFieldHeading[];
		showEmail?: boolean;
		showDetails?: boolean;
		statusOptions?: string[];
		errors?: Record<string, string>;
	} = $props();

	let newTag = $state('');

	function addTagOnEnter(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const v = newTag.trim();
		if (!v) return;
		tags = [...tags, v];
		newTag = '';
	}

	function removeTag(t: string) {
		tags = tags.filter((tag) => tag !== t);
	}
</script>

<div class="form">
	<Input label="Full name" name="name" placeholder="Jordan Lee" bind:value={name} error={errors.name} />
	{#if showEmail}
		<Input
			label="Email"
			name="email"
			type="email"
			placeholder="jordan@example.com"
			bind:value={email}
			error={errors.email}
		/>
	{/if}
	{#if statusOptions}
		<Select label="Status" name="status" options={statusOptions} bind:value={status} />
	{/if}
	<Input label="Rate per session" name="rate" placeholder="150" bind:value={rate} />
	<ClientCustomFields headings={fieldHeadings} bind:values={customFields} />
	{#if showDetails}
		<div>
			<div class="field-label">Tags</div>
			<div class="tag-row">
				{#each tags as t (t)}
					<Tag onremove={() => removeTag(t)}>{t}</Tag>
				{/each}
			</div>
			<Input placeholder="Add a tag and press enter" bind:value={newTag} onkeydown={addTagOnEnter} />
			<input type="hidden" name="tags" value={tags.join(',')} />
		</div>
	{/if}
</div>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 6px;
	}

	.tag-row {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}
</style>