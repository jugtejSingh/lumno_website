<script lang="ts">
	import Button from '../utils/Button.svelte';
</script>

<section class="cta-band">
	<div class="cta-text">Spend less time on the practice, more time in the room.</div>
	<div class="cta-button">
		<Button href="/login?tab=register" variant="pop" size="lg">Get started</Button>
	</div>
</section>

<style>
	.cta-band {
		background: var(--beige-900);
		color: var(--text-inverse);
		padding: 64px 48px;
		text-align: center;
	}

	.cta-text {
		font-family: var(--font-display);
		font-style: italic;
		font-size: 32px;
	}

	.cta-button {
		margin-top: 24px;
	}
</style>