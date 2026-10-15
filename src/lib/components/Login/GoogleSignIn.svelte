<script lang="ts">
	import Button from '$lib/components/utils/Button.svelte';
	import { enhance } from '$lib/enhance';
</script>

<!-- the page's signInGoogle action fixes the role server-side -->
<form class="google-form" method="POST" action="?/signInGoogle" use:enhance>
	<Button type="submit" variant="secondary">Continue with Google</Button>
</form>

<style>
	.google-form {
		margin-top: 16px;
	}

	.google-form :global(.btn) {
		width: 100%;
	}
</style>
