<script lang="ts">
	import Textarea from '$lib/components/utils/Textarea.svelte';
	import {
		clientFieldInputName,
		type ClientFieldHeading,
		type ClientFieldValues
	} from '$lib/types/clientFields';

	// One optional notes box per therapist-defined heading (Settings → Client Profile Fields).
	let {
		headings,
		values = $bindable({})
	}: {
		headings: ClientFieldHeading[];
		values?: ClientFieldValues;
	} = $props();
</script>

{#each headings as heading (heading.id)}
	<Textarea
		label={heading.label}
		name={clientFieldInputName(heading.id)}
		bind:value={() => values[heading.id] ?? '', (v) => (values[heading.id] = v)}
		rows={2}
	/>
{/each}
