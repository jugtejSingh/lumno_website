<script lang="ts">
	import AccessRows from './AccessRows.svelte';

	// AI is a button the practitioner presses; providers keep no copy (see /privacy)
	const ROWS = [
		{ who: 'Copies kept', detail: '0', allowed: false },
		{ who: 'Used for training', detail: 'Never', allowed: false }
	];
</script>

<div class="press">
	<span class="button">✨ Summarise</span>
	<span class="hint">Runs only when you press it</span>
</div>
<AccessRows rows={ROWS} />

<style>
	.press {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		margin-bottom: 22px;
	}

	.button {
		padding: 10px 18px;
		background: var(--surface-card);
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		box-shadow: var(--shadow-sm);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.hint {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--text-primary);
	}
</style>
