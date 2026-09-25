<script lang="ts">
	import Button from '$lib/components/utils/Button.svelte';

	let {
		page,
		totalPages,
		ongoto
	}: { page: number; totalPages: number; ongoto: (target: number) => void } = $props();
</script>

{#if totalPages > 1}
	<div class="pager">
		<Button
			variant="secondary"
			size="sm"
			onclick={() => {
				if (page > 1) {
					ongoto(page - 1);
				}
			}}>Prev</Button
		>
		<span class="pager-label">Page {page} of {totalPages}</span>
		<Button
			variant="secondary"
			size="sm"
			onclick={() => {
				if (page < totalPages) {
					ongoto(page + 1);
				}
			}}>Next</Button
		>
	</div>
{/if}

<style>
	.pager {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
	}

	.pager-label {
		font-size: 13px;
		color: var(--text-muted);
	}
</style>
