<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import InvoicePartyFields from './InvoicePartyFields.svelte';
	import { stateName, type InvoiceParty } from '$lib/invoice';

	// Details that stay the same across invoices: shown as a read-only summary,
	// edited in a dialog so the form itself only holds per-invoice fields.
	// ponytail: edits only change this page until invoice_settings /
	// client_billing exist; then the dialog saves them permanently.
	let {
		title,
		nameLabel,
		gstinInfo,
		emptyText,
		party = $bindable(),
		children
	}: {
		title: string;
		nameLabel: string;
		gstinInfo: string;
		emptyText: string;
		party: InvoiceParty;
		// extra fields shown in the dialog under the party fields
		children?: Snippet;
	} = $props();

	let open = $state(false);

	const isEmpty = $derived(party.name.trim() === '');

	const stateText = $derived.by(() => {
		const name = stateName(party.stateCode);
		if (name === '') {
			return 'No state';
		}
		return `${name} (${party.stateCode})`;
	});

	const gstinText = $derived.by(() => {
		const gstin = party.gstin.trim();
		if (gstin === '') {
			return 'No GSTIN';
		}
		return `GSTIN ${gstin}`;
	});
</script>

<section class="summary">
	<div class="text">
		<h2>{title}</h2>
		{#if isEmpty}
			<p class="empty">{emptyText}</p>
		{:else}
			<p class="name">{party.name}</p>
			<p class="meta">{stateText} · {gstinText}</p>
		{/if}
	</div>
	<Button variant="secondary" size="sm" onclick={() => (open = true)}>
		{#if isEmpty}
			Add details
		{:else}
			Edit details
		{/if}
	</Button>
</section>

<Dialog {open} {title} onclose={() => (open = false)}>
	<div class="dialog-fields">
		<InvoicePartyFields {nameLabel} {gstinInfo} bind:party />
		{#if children}
			{@render children()}
		{/if}
		<div class="actions">
			<Button onclick={() => (open = false)}>Done</Button>
		</div>
	</div>
</Dialog>

<style>
	.summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.text {
		min-width: 0;
	}

	h2 {
		margin: 0 0 4px;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 16px;
		color: var(--text-primary);
	}

	p {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.name {
		font-weight: 700;
		color: var(--text-primary);
	}

	.meta,
	.empty {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.dialog-fields {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
	}
</style>
