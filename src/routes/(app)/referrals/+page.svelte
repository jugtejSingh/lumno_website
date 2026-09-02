<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let query = $state('');
	let selectedId = $state<number | null>(null);

	const filtered = $derived(
		data.therapists.filter(
			(t) =>
				t.name.toLowerCase().includes(query.toLowerCase()) ||
				t.specialtyTags.some((s) => s.label.toLowerCase().includes(query.toLowerCase()))
		)
	);

	const selected = $derived(data.therapists.find((t) => t.id === selectedId) ?? null);
</script>

<div class="referrals">
	<div class="header">
		<div class="title">Referrals</div>
		<div class="subtitle">Find a colleague for a client who needs a different fit</div>
	</div>

	<Input placeholder="Search by name or specialty" bind:value={query} />

	<div class="grid">
		{#each filtered as t (t.id)}
			<Card interactive>
				<button type="button" class="card-btn" onclick={() => (selectedId = t.id)}>
					<div class="card-head">
						<Avatar name={t.name} size={38} />
						<div class="card-head-info">
							<div class="card-name">{t.name}</div>
							<div class="card-format">{t.format}</div>
						</div>
						<Badge tone="success">Open</Badge>
					</div>
					<div class="tag-row">
						{#each t.specialtyTags as s (s.label)}
							<Tag color={s.color}>{s.label}</Tag>
						{/each}
					</div>
					<div class="bio">{t.bio}</div>
					<div class="rate">{t.rate} / session</div>
				</button>
			</Card>
		{/each}
	</div>

	{#if filtered.length === 0}
		<div class="empty">No colleagues match that search.</div>
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
					<div class="detail-meta">{selected.format} · {selected.years} yrs experience</div>
				</div>
			</div>
			<div class="tag-row">
				{#each selected.specialtyTags as s (s.label)}
					<Tag color={s.color}>{s.label}</Tag>
				{/each}
			</div>
			<div class="detail-bio">{selected.bio}</div>
			<div class="detail-rate">{selected.rate} / session</div>
			<Button variant="primary" onclick={() => (selectedId = null)}>Request referral</Button>
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
		font-size: 32px;
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
		grid-template-columns: repeat(3, 1fr);
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
		width: 360px;
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
