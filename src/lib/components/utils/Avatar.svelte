<script lang="ts">
	let { name, size = 36 }: { name: string; size?: number } = $props();

	function initials(fullName: string): string {
		const parts = fullName.split(' ');
		if (parts.length === 1) {
			return parts[0].slice(0, 2).toUpperCase();
		}
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	}
</script>

<div class="avatar" style="width: {size}px; height: {size}px; font-size: {size * 0.36}px">
	{initials(name)}
</div>

<style>
	.avatar {
		flex-shrink: 0;
		border-radius: var(--radius-pill);
		background: var(--plum-400);
		color: var(--text-on-accent);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
	}
</style>