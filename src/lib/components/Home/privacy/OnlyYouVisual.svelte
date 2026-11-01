<script lang="ts">
	import AccessRows from './AccessRows.svelte';
	import LockIcon from './LockIcon.svelte';

	// must match /privacy: a client sees only what their practitioner shared
	const ROWS = [
		{ who: 'You', detail: 'Always', allowed: true },
		{ who: 'Your client', detail: 'Only what you share', allowed: false },
		{ who: 'Practice admin', detail: 'Never', allowed: false }
	];
</script>

<div class="file">
	<span class="lock"><LockIcon /></span>
	<span class="file-name">Priya · Notes</span>
	<span class="line"></span>
	<span class="line line-short"></span>
</div>
<AccessRows rows={ROWS} />

<style>
	.file {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 20px;
		padding: 16px 18px;
		background: var(--surface-card);
		border: 2px solid var(--outline);
		border-radius: var(--radius-md);
	}

	.lock {
		position: absolute;
		top: -14px;
		right: 14px;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: var(--sage-300);
		border: 2px solid var(--outline);
		color: var(--text-primary);
	}

	.file-name {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 16px;
		color: var(--text-primary);
	}

	.line {
		height: 7px;
		border-radius: var(--radius-pill);
		background: var(--surface-sunken);
	}

	.line-short {
		width: 60%;
	}
</style>
