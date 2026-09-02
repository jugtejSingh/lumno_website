<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'secondary' | 'pop';
	type Size = 'sm' | 'md' | 'lg';
	type ButtonType = 'button' | 'submit';

	let {
		href,
		variant = 'primary',
		size = 'md',
		type = 'button',
		onclick,
		children
	}: {
		href?: string;
		variant?: Variant;
		size?: Size;
		type?: ButtonType;
		onclick?: () => void;
		children: Snippet;
	} = $props();
</script>

{#if href}
	<a {href} class="btn btn-{variant} btn-{size}">{@render children()}</a>
{:else}
	<button {type} class="btn btn-{variant} btn-{size}" {onclick}>{@render children()}</button>
{/if}

<style>
	.btn {
		font-family: var(--font-body);
		font-weight: 700;
		font-size: 14px;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		border: none;
		cursor: pointer;
	}

	.btn-sm {
		padding: 6px 14px;
		font-size: 13px;
	}

	.btn-md {
		padding: 9px 18px;
	}

	.btn-lg {
		padding: 13px 24px;
		font-size: 15px;
	}

	.btn-primary {
		background: var(--accent-primary);
		color: var(--text-on-accent);
	}

	.btn-primary:hover {
		background: var(--accent-primary-hover);
		color: var(--text-on-accent);
	}

	.btn-secondary {
		background: var(--surface-card);
		color: var(--text-primary);
		border: 1px solid var(--border-subtle);
	}

	.btn-secondary:hover {
		background: var(--surface-canvas);
		color: var(--text-primary);
	}

	.btn-pop {
		background: var(--accent-pop);
		color: var(--text-on-accent);
	}

	.btn-pop:hover {
		background: var(--accent-pop-hover);
		color: var(--text-on-accent);
	}
</style>