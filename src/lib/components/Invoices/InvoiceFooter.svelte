<!-- styles inlined into server-rendered HTML for the emailed PDF (invoicePdf.ts) -->
<svelte:options css="injected" />

<script lang="ts">
	let {
		footer,
		sellerName,
		signatureUrl = null
	}: { footer: string; sellerName: string; signatureUrl?: string | null } = $props();
</script>

<footer class="footer">
	<div class="note">{footer}</div>
	<div class="signatory">
		<div class="for">For {sellerName || '—'}</div>
		{#if signatureUrl}
			<img class="signature" src={signatureUrl} alt="Signature" />
		{:else}
			<div class="blank"></div>
		{/if}
		<div class="line">Authorised signatory</div>
	</div>
</footer>

<style>
	.footer {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 24px;
		margin-top: auto;
		padding-top: 32px;
	}

	.note {
		white-space: pre-line;
		color: var(--invoice-muted);
		font-size: 12px;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.signatory {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		flex-shrink: 0;
		text-align: right;
	}

	.for {
		font-weight: 700;
	}

	.blank {
		height: 40px;
	}

	.signature {
		display: block;
		max-width: 160px;
		height: 48px;
		margin: 6px 0 4px;
		object-fit: contain;
		object-position: right bottom;
	}

	.line {
		align-self: stretch;
		border-top: 1px solid var(--invoice-ink);
		padding-top: 4px;
		font-size: 12px;
		color: var(--invoice-muted);
	}
</style>
