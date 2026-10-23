<script lang="ts">
	// The client's own timezone, asked for at sign-up. Starts on the browser's guess so
	// they only need to confirm it. `name` is left off when the page mirrors the value
	// into several forms with hidden inputs instead.
	let {
		value = $bindable(),
		name,
		error
	}: {
		value: string;
		name?: string;
		error?: string;
	} = $props();

	const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const options = Intl.supportedValuesOf('timeZone');
	// the guess can be an alias (Asia/Calcutta) the canonical list doesn't have
	if (guess && !options.includes(guess)) {
		options.push(guess);
		options.sort();
	}

	// runs in the browser only, so the guess is the client's, not the server's
	$effect(() => {
		if (!value && guess) {
			value = guess;
		}
	});
</script>

<label class="field">
	<span class="field-label">Your timezone</span>
	<select class="field-input" {name} bind:value required>
		<option value="" disabled>Pick your timezone</option>
		{#each options as tz (tz)}
			<option value={tz}>{tz}</option>
		{/each}
	</select>
	<span class="hint">Session times and reminders use this. You can change it later.</span>
	{#if error}
		<span class="form-error" role="alert">{error}</span>
	{/if}
</label>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
	}

	.field-label {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-secondary);
	}

	.field-input {
		width: 100%;
		box-sizing: border-box;
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-inset);
		padding: 10px 12px;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--outline);
		background: var(--coral-100);
		box-shadow: var(--shadow-focus);
	}

	.hint {
		font-size: 13px;
		color: var(--text-muted);
	}

	.form-error {
		font-size: 14px;
		font-weight: 700;
		color: var(--accent-danger, #c0392b);
	}
</style>
