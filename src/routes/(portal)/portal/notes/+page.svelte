<script lang="ts">
	import { goto } from '$app/navigation';
	import { renderMarkdown } from '$lib/markdown';
	import Card from '$lib/components/utils/Card.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';
	import Pager from '$lib/components/utils/Pager.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function gotoPage(target: number) {
		goto(`?page=${target}`, { keepFocus: true });
	}
</script>

<div class="section">
	<div class="section-title">Notes & follow-ups from {data.therapistName.split(' ')[0]}</div>
	{#each data.sharedNotes as n (n.date + n.text)}
		<Card>
			<div class="shared-head">
				<div class="mono-date">{n.date}</div>
				<Tag color="sage">From {data.therapistName.split(' ')[0]}</Tag>
			</div>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized in renderMarkdown -->
			<div class="note-text">{@html renderMarkdown(n.text)}</div>
		</Card>
	{/each}
	{#if data.sharedNotes.length === 0}
		<div class="hint">Nothing shared yet.</div>
	{/if}
	<Pager page={data.page} totalPages={data.totalPages} ongoto={gotoPage} />
</div>

<style>
	.section {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-width: 760px;
		padding-bottom: 24px;
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

	.shared-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 6px;
	}

	.mono-date {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
	}

	.note-text {
		font-size: 14px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
	}
</style>
