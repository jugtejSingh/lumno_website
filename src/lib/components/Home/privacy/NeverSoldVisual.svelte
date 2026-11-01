<script lang="ts">
	import AccessRows from './AccessRows.svelte';

	// notes are never in Google events (empty description) or Razorpay orders (ids only)
	const ROWS = [
		{ who: 'Google', detail: 'Never', allowed: false },
		{ who: 'Razorpay', detail: 'Never', allowed: false },
		{ who: 'Advertisers', detail: 'Never', allowed: false }
	];
</script>

<p class="label">Who gets your notes</p>
<AccessRows rows={ROWS} />

<style>
	.label {
		margin: 0 0 14px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--text-primary);
	}
</style>
