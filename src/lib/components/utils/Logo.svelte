<script lang="ts">
	let { size = 26, inverse = false }: { size?: number; inverse?: boolean } = $props();
</script>

<a href="/" class="logo" class:inverse style="font-size: {size}px">Lumno</a>

<style>
	.logo {
		font-family: var(--font-display);
		font-style: italic;
		color: var(--text-primary);
		text-decoration: none;
	}

	.logo.inverse {
		color: var(--text-inverse);
	}
</style>
