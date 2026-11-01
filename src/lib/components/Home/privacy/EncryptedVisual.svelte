<script lang="ts">
	import LockIcon from './LockIcon.svelte';

	// what you type on top, what actually sits on the disk below
</script>

<div class="flow">
	<span class="text">Feeling calmer since…</span>
	<span class="lock"><LockIcon /></span>
	<span class="text scrambled">x9#Qe·7$kLm2…</span>
	<span class="caption">What's stored</span>
</div>

<style>
	.flow {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
	}

	.text {
		width: 100%;
		max-width: 260px;
		box-sizing: border-box;
		padding: 10px 14px;
		background: var(--surface-card);
		border: 2px solid var(--outline);
		border-radius: var(--radius-sm);
		font-size: 14px;
		text-align: center;
		color: var(--text-primary);
	}

	.scrambled {
		font-family: ui-monospace, monospace;
		letter-spacing: 0.06em;
		color: var(--text-secondary);
	}

	.lock {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--surface-card);
		border: 2px solid var(--outline);
		color: var(--text-primary);
	}

	.caption {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--text-primary);
	}
</style>
