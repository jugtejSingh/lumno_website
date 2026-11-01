<script lang="ts">
	import WeekLists from './WeekLists.svelte';
</script>

<section class="week">
	<div class="week-heading">
		<h2 class="display">Your week, minus the admin</h2>
	</div>
	<WeekLists />
</section>

<style>
	.week {
		padding: clamp(40px, 6vw, 64px) max(clamp(16px, 5vw, 48px), calc((100% - 1200px) / 2));
		/* full-width band to break up the dotted page background */
		background: var(--surface-sunken);
		border-top: 2px solid var(--outline);
		border-bottom: 2px solid var(--outline);
	}

	.week-heading {
		text-align: center;
		margin-bottom: 32px;
	}

	.display {
		font-family: var(--font-display);
		color: var(--text-primary);
		margin: 0;
		font-weight: 600;
		font-size: clamp(26px, 5vw, 36px);
	}
</style>
