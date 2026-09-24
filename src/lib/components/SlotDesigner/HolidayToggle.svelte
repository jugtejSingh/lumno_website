<script lang="ts">
	// On = the weekday is a holiday: its slots are kept but clients can't book it
	let { holiday = $bindable(), dayName }: { holiday: boolean; dayName: string } = $props();
</script>

<label class="holiday-toggle">
	<span class="state">
		{#if holiday}
			Holiday
		{:else}
			Bookable
		{/if}
	</span>
	<input type="checkbox" role="switch" aria-label="{dayName} is a holiday" bind:checked={holiday} />
	<span class="track" aria-hidden="true"><span class="dot"></span></span>
</label>

<style>
	.holiday-toggle {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}

	.state {
		font-family: var(--font-mono);
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	/* the real checkbox stays for keyboard and screen readers; the track is its picture */
	input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}

	.track {
		position: relative;
		width: 40px;
		height: 22px;
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		background: var(--surface-sunken);
		transition: background 0.15s;
	}

	.dot {
		position: absolute;
		top: 1px;
		left: 1px;
		width: 16px;
		height: 16px;
		border: 2px solid var(--outline);
		border-radius: 50%;
		background: var(--surface-card);
		transform: translateX(0);
		transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	input:checked + .track {
		background: var(--citrus-400);
	}

	input:checked + .track .dot {
		transform: translateX(18px);
	}

	input:focus-visible + .track {
		box-shadow: var(--shadow-focus);
	}
</style>
