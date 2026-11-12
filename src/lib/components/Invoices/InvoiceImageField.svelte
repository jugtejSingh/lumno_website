<script lang="ts">
	import Switch from '$lib/components/utils/Switch.svelte';
	import InfoTip from '$lib/components/utils/InfoTip.svelte';

	// One uploaded image (logo or signature). Uncontrolled file input; the
	// action reads `name` for a new file and `removeName` = 'on' to clear it.
	let {
		label,
		info,
		name,
		removeName,
		currentUrl,
		error = '',
		fileName = $bindable(''),
		remove = $bindable(false)
	}: {
		label: string;
		info: string;
		name: string;
		removeName: string;
		currentUrl: string | null;
		error?: string;
		fileName?: string;
		remove?: boolean;
	} = $props();
</script>

<div class="image-field">
	<input type="hidden" name={removeName} value={remove ? 'on' : ''} />
	{#if currentUrl}
		<img class="preview" src={currentUrl} alt="Your current {label.toLowerCase()}" />
		<Switch label="Remove on save" bind:checked={remove} />
	{/if}
	<label class="field">
		<span class="field-label">
			{currentUrl ? `Replace ${label}` : label}<InfoTip {label} text={info} />
		</span>
		<input
			class="field-input"
			type="file"
			{name}
			accept="image/png,image/jpeg,image/webp"
			aria-invalid={Boolean(error)}
			onchange={(e) => (fileName = e.currentTarget.files?.[0]?.name ?? '')}
		/>
		{#if error}
			<span class="field-error" role="alert">{error}</span>
		{/if}
	</label>
</div>

<style>
	.image-field {
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: flex-start;
	}

	.preview {
		max-width: 200px;
		max-height: 100px;
		object-fit: contain;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
	}

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
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
	}

	.field-error {
		font-size: 14px;
		font-weight: 700;
		color: var(--accent-danger, #c0392b);
	}
</style>
