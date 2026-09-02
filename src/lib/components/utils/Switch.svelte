<script lang="ts">
	let {
		label,
		checked = $bindable(false)
	}: {
		label?: string;
		checked?: boolean;
	} = $props();
</script>

<label class="switch-row">
	<button
		type="button"
		class="switch"
		class:on={checked}
		role="switch"
		aria-checked={checked}
		aria-label={label}
		onclick={() => (checked = !checked)}
	>
		<span class="switch-knob"></span>
	</button>
	{#if label}
		<span class="switch-label">{label}</span>
	{/if}
</label>

<style>
	.switch-row {
		display: flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
	}

	.switch {
		width: 38px;
		height: 22px;
		flex-shrink: 0;
		border: none;
		border-radius: var(--radius-pill);
		background: var(--border-strong);
		padding: 2px;
		cursor: pointer;
		display: flex;
		align-items: center;
	}

	.switch.on {
		background: var(--accent-primary);
		justify-content: flex-end;
	}

	.switch-knob {
		width: 18px;
		height: 18px;
		border-radius: var(--radius-pill);
		background: var(--surface-card);
		box-shadow: var(--shadow-xs);
	}

	.switch-label {
		font-size: 14px;
		color: var(--text-primary);
	}
</style>
