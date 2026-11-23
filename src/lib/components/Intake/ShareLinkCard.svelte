<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$lib/enhance';

	let { token, questionCount }: { token: string | null; questionCount: number } = $props();

	const link = $derived(token ? `${page.url.origin}/forms/${token}` : '');

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(link);
			toast.success('Link copied');
		} catch {
			toast.error('Could not copy — select the link and copy it by hand');
		}
	}
</script>

<Card>
	<div class="section">
		{#if token}
			<div class="link-row">
				<input class="link-input" readonly value={link} aria-label="Intake form link" />
				<Button size="sm" onclick={copyLink}>Copy link</Button>
			</div>
			{#if questionCount === 0}
				<div class="helper">Your form has no questions yet. Add some before you share the link.</div>
			{:else}
				<div class="helper">Anyone with this link can fill in your form. It doesn't expire.</div>
			{/if}
			<div class="actions">
				<form method="POST" action="?/generateLink" use:enhance>
					<Button type="submit" variant="secondary" size="sm">New link</Button>
				</form>
				<form method="POST" action="?/disableLink" use:enhance>
					<Button type="submit" variant="secondary" size="sm">Turn off</Button>
				</form>
			</div>
			<div class="helper">
				A new link stops the old one working straight away, so only make one if the old link got out
				somewhere it shouldn't have.
			</div>
		{:else}
			<div class="helper">Your form's link is off. Nobody can fill in your form until you turn it on.</div>
			<form method="POST" action="?/generateLink" use:enhance>
				<Button type="submit">Turn on</Button>
			</form>
		{/if}
	</div>
</Card>

<style>
	.section {
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: flex-start;
	}

	.helper {
		font-size: 13px;
		color: var(--text-muted);
	}

	.actions {
		display: flex;
		gap: 8px;
	}

	.link-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		width: 100%;
	}

	.link-input {
		flex: 1;
		min-width: 200px;
		box-sizing: border-box;
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-inset);
		padding: 8px 10px;
	}
</style>
