<script lang="ts">
	import InfoTip from './InfoTip.svelte';
	let {
		label,
		info,
		checked = $bindable(false),
		locked = false,
		onlockedclick
	}: {
		label?: string;
		// explanation behind an "i" button next to the label
		info?: string;
		checked?: boolean;
		// shown but can't be flipped — a click calls onlockedclick instead (e.g. to explain why)
		locked?: boolean;
		onlockedclick?: () => void;
	} = $props();

	function handleClick() {
		if (locked) {
			onlockedclick?.();
		} else {
			checked = !checked;
		}
	}
</script>

<label class="switch-row" class:locked>
	<button
		type="button"
		class="switch"
		class:on={checked && !locked}
		role="switch"
		aria-checked={checked && !locked}
		aria-disabled={locked}
		aria-label={label}
		onclick={handleClick}
	>
		<span class="switch-knob"></span>
	</button>
	{#if label}
		<span class="switch-label">{label}{#if info}<InfoTip text={info} {label} />{/if}</span>
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
		width: 42px;
		height: 24px;
		flex-shrink: 0;
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		background: var(--beige-200);
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
		width: 16px;
		height: 16px;
		border-radius: var(--radius-pill);
		background: var(--surface-card);
		border: 2px solid var(--outline);
	}

	.switch-label {
		font-size: 14px;
		color: var(--text-primary);
	}

	.locked .switch,
	.locked .switch-label {
		opacity: 0.5;
	}
</style>
