<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Card from '$lib/components/utils/Card.svelte';
	import ResourceAddForm from '$lib/components/Resources/ResourceAddForm.svelte';
	import ResourceList from '$lib/components/Resources/ResourceList.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="section">
	<div class="section-title">Resources</div>
	<div class="hint">
		Prescriptions, reports, reading and links — shared between you and {data.therapistName.split(' ')[0]}.
	</div>
	<Card>
		<ResourceAddForm onsaved={invalidateAll} />
	</Card>
	<ResourceList resources={data.resources} viewer="client" ondeleted={invalidateAll} />
</div>

<style>
	.section {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-width: 760px;
	}

	.section-title {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.hint {
		font-size: 13px;
		color: var(--text-muted);
	}
</style>
