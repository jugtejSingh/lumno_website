<script lang="ts">
	import ShareLinkCard from '$lib/components/Intake/ShareLinkCard.svelte';
	import ResponseList from '$lib/components/Intake/ResponseList.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Intake</title>
</svelte:head>

<div class="page">
	<div class="header">
		<Button variant="secondary" href="/intake/edit">Edit form</Button>
	</div>
	<ShareLinkCard token={data.shareToken} questionCount={data.questionCount} />
	<ResponseList responses={data.responses} />
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 20px;
		max-width: 760px;
	}

	.header {
		display: flex;
		justify-content: flex-end;
	}
</style>
