<script lang="ts">
	// every row here must stay true of the Free plan (see src/lib/data/plans.ts)
	const ROWS: { label: string; value: string }[] = [
		{ label: 'Plan', value: 'Free forever' },
		{ label: 'Start', value: 'Right now' },
		{ label: 'Clients', value: 'Up to 10' },
		{ label: 'Appointments', value: 'Unlimited' },
		{ label: 'Reminders and Meet links', value: 'Included' },
		{ label: 'Commission on your fees', value: '0%' },
		{ label: 'Card details', value: 'Not needed' },
		{ label: 'Payment to sign up', value: 'None' },
		{ label: 'Free trial ends', value: 'Never' }
	];
</script>

<div class="receipt" aria-label="What your free account costs">
	<div class="receipt-title">Your Lumno account</div>
	<dl class="rows">
		{#each ROWS as row (row.label)}
			<div class="row">
				<dt>{row.label}</dt>
				<dd>{row.value}</dd>
			</div>
		{/each}
	</dl>
	<div class="total">
		<span class="total-label">Due today</span>
		<span class="total-value">₹0</span>
	</div>
</div>

<style>
	.receipt {
		background: var(--surface-card);
		border: 2px solid var(--outline);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 22px 24px 20px;
		width: 100%;
		max-width: 360px;
		box-sizing: border-box;
		text-align: left;
	}

	.receipt-title {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--text-secondary);
		padding-bottom: 12px;
		border-bottom: 2px solid var(--outline);
	}

	.rows {
		margin: 0;
		padding: 6px 0;
	}

	.row {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		padding: 6px 0;
		font-size: 15px;
	}

	dt {
		color: var(--text-secondary);
	}

	dd {
		margin: 0;
		font-weight: 700;
		color: var(--text-primary);
	}

	.total {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding-top: 12px;
		border-top: 2px dashed var(--outline);
	}

	.total-label {
		font-weight: 700;
		color: var(--text-primary);
	}

	.total-value {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 38px;
		line-height: 1;
		color: var(--text-primary);
	}
</style>
