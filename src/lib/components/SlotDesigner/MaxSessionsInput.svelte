<script lang="ts">
	// blank = no limit
	let { value = $bindable() }: { value: number | null } = $props();

	function oninput(event: Event & { currentTarget: HTMLInputElement }) {
		const raw = event.currentTarget.value.trim();
		if (raw === '') {
			value = null;
		} else {
			// the server rejects anything that isn't a whole number 1–50; a value still
			// mid-typing (lone "-" or ".") parses to NaN, which JSON.stringify would
			// silently turn into "no limit" on save — ignore it instead of committing
			const parsed = Number(raw);
			if (!Number.isNaN(parsed)) {
				value = parsed;
			}
		}
	}
</script>

<label class="max-sessions">
	<span>Max sessions</span>
	<input type="number" min="1" max="50" step="1" placeholder="No limit" value={value ?? ''} {oninput} />
</label>

<style>
	.max-sessions {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-secondary);
	}

	input {
		width: 84px;
		font-family: var(--font-body);
		font-size: 12px;
		padding: 4px 8px;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
		color: var(--text-primary);
	}
</style>
