<script lang="ts">
	let { footer, sellerName }: { footer: string; sellerName: string } = $props();
</script>

<footer class="footer">
	<div class="note">{footer}</div>
	<div class="signatory">
		<div class="for">For {sellerName || '—'}</div>
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
		flex-shrink: 0;
		text-align: right;
	}

	.for {
		font-weight: 700;
		margin-bottom: 40px;
	}

	.line {
		border-top: 1px solid var(--invoice-ink);
		padding-top: 4px;
		font-size: 12px;
		color: var(--invoice-muted);
	}
</style>
