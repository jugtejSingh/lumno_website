<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import InfoTip from '$lib/components/utils/InfoTip.svelte';
	import { enhance } from '$lib/enhance';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';

	let { token, expiresAt }: { token: string | null; expiresAt: Date | null } = $props();

	const link = $derived(token ? `${page.url.origin}/outreach/${token}` : '');
	const expiresLabel = $derived(
		expiresAt
			? expiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
			: ''
	);

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
		<div class="section-title">
			Discovery Call Page<InfoTip
				label="Discovery Call Page"
				text="A public page where anyone with the link can book a free intro call in your open slots. No account needed. The link works for 7 days, then stops."
			/>
		</div>

		{#if token}
			<div class="helper">
				Share this link. It stops working on {expiresLabel}, or as soon as you turn it off or make a
				new one.
			</div>
			<div class="link-row">
				<input class="link-input" readonly value={link} aria-label="Discovery call link" />
				<Button variant="secondary" size="sm" onclick={copyLink}>Copy</Button>
			</div>
			<div class="actions">
				<form method="POST" action="?/generateOutreach" use:enhance>
					<Button type="submit" variant="secondary" size="sm">New link</Button>
				</form>
				<form method="POST" action="?/disableOutreach" use:enhance>
					<Button type="submit" variant="secondary" size="sm">Turn off</Button>
				</form>
			</div>
		{:else}
			<div class="helper">Off. Nobody can book a discovery call until you turn it on.</div>
			<form method="POST" action="?/generateOutreach" use:enhance>
				<Button type="submit" variant="primary" size="sm">Turn on</Button>
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

	.section-title {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.helper {
		font-size: 13px;
		color: var(--text-muted);
	}

	.link-row {
		display: flex;
		gap: 8px;
		width: 100%;
	}

	.link-input {
		flex: 1;
		min-width: 0;
		box-sizing: border-box;
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-inset);
		padding: 8px 10px;
	}

	.actions {
		display: flex;
		gap: 8px;
	}
</style>
