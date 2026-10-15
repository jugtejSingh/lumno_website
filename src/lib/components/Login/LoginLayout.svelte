<script lang="ts">
	import type { Snippet } from 'svelte';
	import Logo from '$lib/components/utils/Logo.svelte';
	import Footer from '$lib/components/utils/Footer.svelte';

	let {
		title,
		subtitle,
		wide = false,
		short = false,
		banners,
		children
	}: {
		title: string;
		subtitle: string;
		wide?: boolean;
		short?: boolean;
		banners?: Snippet;
		children: Snippet;
	} = $props();
</script>

<div class="page">
	<div class="header">
		<Logo />
	</div>

	<div class="center">
		<div class="auth-card" class:wide class:short>
			{#if banners}
				{@render banners()}
			{/if}

			<div class="card-head">
				<div class="form-title">{title}</div>
				<div class="form-subtitle">{subtitle}</div>
			</div>

			{@render children()}
		</div>
	</div>

	<Footer />
</div>

<style>
	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--wallpaper) var(--surface-app);
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px clamp(20px, 5vw, 48px);
		border-bottom: 2px solid var(--border-subtle);
		background: var(--surface-canvas);
	}

	.center {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 40px;
	}

	.auth-card {
		width: min(380px, 100%);
		background: var(--surface-card);
		border: 2px solid var(--border-subtle);
		border-top-width: 14px;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 36px;
		/* ponytail: shared frame so the practitioner and client cards match in shape; inner content can differ */
		min-height: 540px;
		transition:
			width var(--duration-base) var(--ease-out),
			min-height var(--duration-base) var(--ease-out);
	}

	.auth-card.wide {
		width: min(440px, 100%);
	}

	.auth-card.short {
		min-height: 420px;
	}

	@media (max-width: 480px) {
		.header {
			padding: 16px 20px;
		}

		.center {
			padding: 20px;
		}

		.auth-card {
			padding: 24px;
			min-height: 0;
		}
	}

	.form-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(24px, 5vw, 30px);
		color: var(--text-primary);
	}

	.form-subtitle {
		font-size: 14px;
		color: var(--text-muted);
		margin-top: 4px;
		margin-bottom: 24px;
	}
</style>
