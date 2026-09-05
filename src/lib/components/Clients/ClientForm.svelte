<script lang="ts">
	import Input from '$lib/components/utils/Input.svelte';
	import Textarea from '$lib/components/utils/Textarea.svelte';
	import Select from '$lib/components/utils/Select.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';

	let {
		name = $bindable(''),
		email = $bindable(''),
		age = $bindable(''),
		rate = $bindable(''),
		bio = $bindable(''),
		tags = $bindable([]),
		status = $bindable(''),
		showEmail = true,
		statusOptions,
		errors = {}
	}: {
		name?: string;
		email?: string;
		age?: string;
		rate?: string;
		bio?: string;
		tags?: string[];
		status?: string;
		showEmail?: boolean;
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
	<div class="row">
		<Input label="Age" name="age" placeholder="34" bind:value={age} />
		<Input label="Rate per session" name="rate" placeholder="150" bind:value={rate} />
	</div>
	<Textarea
		label="Bio"
		name="bio"
		placeholder="A short blurb on who this client is"
		bind:value={bio}
		rows={3}
	/>
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
</div>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.row {
		display: flex;
		gap: 10px;
	}

	.row > :global(*) {
		flex: 1;
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