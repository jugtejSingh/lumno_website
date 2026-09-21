<script lang="ts">
	let { sections }: { sections: { id: string; title: string }[] } = $props();
</script>

<nav class="toc" aria-label="Guide contents">
	<div class="toc-title">Contents</div>
	<ol>
		{#each sections as s (s.id)}
			<li><a href="#{s.id}">{s.title}</a></li>
		{/each}
	</ol>
</nav>

<style>
	.toc {
		padding: 14px 16px;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-md, 8px);
		background: var(--surface-canvas);
	}

	.toc-title {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		margin-bottom: 8px;
	}

	ol {
		margin: 0;
		padding-left: 20px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
	}

	a {
		color: var(--text-secondary);
		text-decoration: none;
	}

	a:hover {
		color: var(--text-primary);
		text-decoration: underline;
	}

</style>
