<script lang="ts">
	import Button from '../utils/Button.svelte';
</script>

<section class="cta-band">
	<div class="cta-text">Five apps out. One calm practice in.</div>
	<div class="cta-button">
		<Button href="/login?tab=register" variant="pop" size="lg">Get started</Button>
	</div>
</section>

<style>
	.cta-band {
		background: var(--plum-300);
		border-top: 2px solid var(--outline);
		border-bottom: 2px solid var(--outline);
		color: var(--text-primary);
		padding: clamp(44px, 8vw, 64px) clamp(16px, 5vw, 48px);
		text-align: center;
	}

	.cta-text {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(24px, 5vw, 32px);
	}

	.cta-button {
		margin-top: 24px;
	}
</style>