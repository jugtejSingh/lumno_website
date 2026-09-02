<script lang="ts">
	// Native <input type="time"> renders in whatever format the OS locale picks (often 24h),
	// and there's no HTML attribute to force 12h — so this is a small 12h picker instead.
	// The bound value stays a plain "HH:MM" 24h string, same shape as type="time" everywhere else.
	let {
		label,
		name,
		value = $bindable('09:00')
	}: {
		label?: string;
		name?: string;
		value?: string;
	} = $props();

	const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1);

	const hour24 = $derived(Number(value.split(':')[0] ?? 0));
	const minute = $derived(Number(value.split(':')[1] ?? 0));
	const hour12 = $derived(hour24 % 12 || 12);
	const ampm = $derived(hour24 < 12 ? 'AM' : 'PM');

	function commit(nextHour12: number, nextMinute: number, nextAmpm: string) {
		let h = nextHour12 % 12;
		if (nextAmpm === 'PM') h += 12;
		const hh = String(h).padStart(2, '0');
		const mm = String(Math.min(59, Math.max(0, nextMinute))).padStart(2, '0');
		value = `${hh}:${mm}`;
	}
</script>

<label class="field">
	{#if label}
		<span class="field-label">{label}</span>
	{/if}
	<div class="time-row">
		<select
			class="field-input"
			value={hour12}
			onchange={(e) => commit(Number(e.currentTarget.value), minute, ampm)}
		>
			{#each hourOptions as h (h)}
				<option value={h}>{h}</option>
			{/each}
		</select>
		<input
			class="field-input minute"
			type="number"
			min="0"
			max="59"
			value={String(minute).padStart(2, '0')}
			onchange={(e) => commit(hour12, Number(e.currentTarget.value), ampm)}
		/>
		<select class="field-input" value={ampm} onchange={(e) => commit(hour12, minute, e.currentTarget.value)}>
			<option value="AM">AM</option>
			<option value="PM">PM</option>
		</select>
	</div>
	{#if name}<input type="hidden" {name} {value} />{/if}
</label>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.time-row {
		display: flex;
		gap: 6px;
	}

	.field-input {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
	}

	.minute {
		width: 60px;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: var(--shadow-focus);
	}
</style>
