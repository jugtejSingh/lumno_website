<script lang="ts">
	import Input from '$lib/components/utils/Input.svelte';
	import Select from '$lib/components/utils/Select.svelte';
	import ClientCustomFields from '$lib/components/Clients/ClientCustomFields.svelte';
	import type { ClientFieldHeading, ClientFieldValues } from '$lib/types/clientFields';

	let {
		name = $bindable(''),
		email = $bindable(''),
		rate = $bindable(''),
		status = $bindable(''),
		customFields = $bindable({}),
		fieldHeadings = [],
		showEmail = true,
		statusOptions,
		errors = {}
	}: {
		name?: string;
		email?: string;
		rate?: string;
		status?: string;
		customFields?: ClientFieldValues;
		fieldHeadings?: ClientFieldHeading[];
		showEmail?: boolean;
		statusOptions?: string[];
		errors?: Record<string, string>;
	} = $props();
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
</div>

<style>
	.form {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
	}

	/* two fields per row; an odd one out grows to fill the row instead of leaving a gap */
	.form :global(.field) {
		flex: 1 1 calc(50% - 7px);
		min-width: 200px;
	}
</style>