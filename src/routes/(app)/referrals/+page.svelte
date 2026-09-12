<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// search box draft: seeded from the initial URL query only; the effect below owns updates
	let query = $state(untrack(() => data.q));
	let selectedId = $state<string | null>(null);

	// debounced server-side search — resets to page 1 on every change
	let firstRun = true;
	$effect(() => {
		const q = query;
		if (firstRun) {
			firstRun = false;
			return;
		}
		const timer = setTimeout(() => {
			let href = '?';
			if (q.trim()) {
				href = `?q=${encodeURIComponent(q.trim())}`;
			}
			goto(href, { keepFocus: true, noScroll: true });
		}, 250);
		return () => clearTimeout(timer);
	});

	const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.perPage)));
	const selected = $derived(data.therapists.find((t) => t.id === selectedId) ?? null);

	function metaLine(format: string | null, location: string | null): string {
		const parts = [];
		if (format) {
			parts.push(format);
		}
		if (location) {
			parts.push(location);
		}
		return parts.join(' · ');
	}

	function pageHref(p: number): string {
		let href = `?page=${p}`;
		if (data.q.trim()) {
			href = `?q=${encodeURIComponent(data.q.trim())}&page=${p}`;
		}
		return href;
	}
</script>

<div class="referrals">
	<div class="header">
		<div class="title">Referrals</div>
		<div class="subtitle">Find a colleague for a client who needs a different fit</div>
	</div>

	<Input placeholder="Search by name or specialty" bind:value={query} />

	<div class="grid">
		{#each data.therapists as t (t.id)}
			<Card interactive>
				<button type="button" class="card-btn" onclick={() => (selectedId = t.id)}>
					<div class="card-head">
						<Avatar name={t.name} size={38} />
						<div class="card-head-info">
							<div class="card-name">{t.name}</div>
							{#if metaLine(t.format, t.location)}
								<div class="card-format">{metaLine(t.format, t.location)}</div>
							{/if}
						</div>
						<Badge tone="success">Open</Badge>
					</div>
					<div class="tag-row">
						{#each t.specialtyTags as s (s.label)}
							<Tag color={s.color}>{s.label}</Tag>
						{/each}
					</div>
					<div class="bio">{t.bio}</div>
					{#if t.rate}
						<div class="rate">{t.rate} / session</div>
					{/if}
				</button>
			</Card>
		{/each}
	</div>

	{#if data.therapists.length === 0}
		<div class="empty">
			{data.q ? 'No colleagues match that search.' : 'No colleagues have opted in yet.'}
		</div>
	{/if}

	{#if totalPages > 1}
		<div class="pager">
			{#if data.page > 1}
				<Button variant="secondary" size="sm" href={pageHref(data.page - 1)}>Previous</Button>
			{/if}
			<span class="pager-label">Page {data.page} of {totalPages}</span>
			{#if data.page < totalPages}
				<Button variant="secondary" size="sm" href={pageHref(data.page + 1)}>Next</Button>
			{/if}
		</div>
	{/if}

	<div class="footnote">
		Only therapists who've opted in appear here. Manage your own visibility in Settings.
	</div>
</div>

<Dialog open={selected !== null} title={selected?.name ?? ''} onclose={() => (selectedId = null)}>
	{#if selected}
		<div class="detail">
			<div class="detail-head">
				<Avatar name={selected.name} size={48} />
				<div>
					<div class="detail-name">{selected.name}</div>
					{#if metaLine(selected.format, selected.location) || selected.years !== null}
						<div class="detail-meta">
							{[
								metaLine(selected.format, selected.location),
								selected.years !== null ? `${selected.years} yrs experience` : ''
							]
								.filter(Boolean)
								.join(' · ')}
						</div>
					{/if}
				</div>
			</div>
			<div class="tag-row">
				{#each selected.specialtyTags as s (s.label)}
					<Tag color={s.color}>{s.label}</Tag>
				{/each}
			</div>
			<div class="detail-bio">{selected.bio}</div>
			{#if selected.rate}
				<div class="detail-rate">{selected.rate} / session</div>
			{/if}
		</div>
	{/if}
</Dialog>

<style>
	.referrals {
		display: flex;
		flex-direction: column;
		gap: 20px;
		max-width: 1040px;
	}

	.title {
		font-family: var(--font-display);
		font-size: clamp(24px, 5vw, 32px);
		color: var(--text-primary);
	}

	.subtitle {
		font-family: var(--font-display);
		font-style: italic;
		font-size: 16px;
		color: var(--text-muted);
		margin-top: 2px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
		gap: 16px;
	}

	.card-btn {
		display: flex;
		flex-direction: column;
		gap: 10px;
		height: 100%;
		width: 100%;
		border: none;
		background: transparent;
		text-align: left;
		cursor: pointer;
		padding: 0;
		font-family: var(--font-body);
	}

	.card-head {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.card-head-info {
		flex: 1;
		min-width: 0;
	}

	.card-name {
		font-weight: 700;
		color: var(--text-primary);
	}

	.card-format {
		font-size: 12px;
		color: var(--text-muted);
	}

	.tag-row {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.bio {
		font-size: 13px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
		flex: 1;
		overflow: hidden;
	}

	.rate {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text-muted);
	}

	.pager {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.pager-label {
		font-size: 13px;
		color: var(--text-muted);
	}

	.empty,
	.footnote {
		color: var(--text-muted);
		font-size: 14px;
	}

	.footnote {
		font-size: 12px;
	}

	.detail {
		display: flex;
		flex-direction: column;
		gap: 14px;
		width: min(360px, 100%);
	}

	.detail-head {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.detail-name {
		font-weight: 700;
		color: var(--text-primary);
	}

	.detail-meta {
		font-size: 13px;
		color: var(--text-muted);
	}

	.detail-bio {
		font-size: 14px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
	}

	.detail-rate {
		font-family: var(--font-mono);
		font-size: 14px;
		color: var(--text-primary);
	}
</style>
