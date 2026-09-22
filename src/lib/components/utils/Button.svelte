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
		formaction,
		disabled = false,
		onclick,
		children
	}: {
		href?: string;
		variant?: Variant;
		size?: Size;
		type?: ButtonType;
		// lets a submit button inside a form post to a different action (SvelteKit ?/name)
		formaction?: string;
		disabled?: boolean;
		onclick?: () => void;
		children: Snippet;
	} = $props();
</script>

{#if href}
	<a {href} class="btn btn-{variant} btn-{size}">{@render children()}</a>
{:else}
	<button {type} {formaction} {disabled} class="btn btn-{variant} btn-{size}" {onclick}
		>{@render children()}</button
	>
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
		border: 2px solid var(--outline);
		box-shadow: var(--shadow-sm);
		cursor: pointer;
		transition:
			transform var(--duration-fast) var(--ease-standard),
			box-shadow var(--duration-fast) var(--ease-standard),
			background var(--duration-fast) var(--ease-standard);
	}

	.btn:hover {
		text-decoration: none;
		transform: translate(-1px, -1px);
		box-shadow: var(--shadow-md);
	}

	.btn:active {
		transform: translate(2px, 2px);
		box-shadow: 1px 1px 0 var(--outline);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
		box-shadow: var(--shadow-sm);
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
	}

	.btn-secondary:hover {
		background: var(--coral-100);
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