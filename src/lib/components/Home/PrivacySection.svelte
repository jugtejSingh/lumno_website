<script lang="ts">
	import type { Component } from 'svelte';
	import OnlyYouVisual from './privacy/OnlyYouVisual.svelte';
	import EncryptedVisual from './privacy/EncryptedVisual.svelte';
	import AiForgetsVisual from './privacy/AiForgetsVisual.svelte';
	import NeverSoldVisual from './privacy/NeverSoldVisual.svelte';

	// every point here must match something the privacy policy (/privacy) already promises
	const POINTS: {
		title: string;
		body: string;
		accent: 'plum' | 'coral' | 'sage' | 'citrus';
		visual: Component;
	}[] = [
		{
			title: 'Only you see your clients',
			body: 'Your clients, notes and sessions are yours alone. Clients see only what you share with them.',
			accent: 'plum',
			visual: OnlyYouVisual
		},
		{
			title: 'Encrypted in transit and at rest',
			body: 'Locked on the way to us and on our disks. Passwords are never stored.',
			accent: 'sage',
			visual: EncryptedVisual
		},
		{
			title: 'AI only when you ask',
			body: 'Nothing runs on its own. It sees just the note it needs, and the provider keeps no copy.',
			accent: 'coral',
			visual: AiForgetsVisual
		},
		{
			title: 'Confidential data never leaves',
			body: 'Session notes and client records stay encrypted inside Lumno. They never go to Google, Razorpay or anyone else, unless you ask AI for help. Nothing is ever sold.',
			accent: 'citrus',
			visual: NeverSoldVisual
		}
	];
</script>

<section id="privacy" class="privacy">
	<div class="privacy-heading">
		<h2 class="display">Your clients' trust, kept</h2>
		<p class="lede">Confidentiality is the job. We built Lumno around it.</p>
	</div>

	<ul class="points">
		{#each POINTS as point (point.title)}
			<li class="point accent-{point.accent}">
				<div class="visual"><point.visual /></div>
				<div class="copy">
					<h3 class="point-title">{point.title}</h3>
					<p class="point-body">{point.body}</p>
				</div>
			</li>
		{/each}
	</ul>

	<p class="more"><a href="/privacy">Read the full privacy policy →</a></p>
</section>

<style>
	.privacy {
		padding: clamp(40px, 6vw, 64px) max(clamp(16px, 5vw, 48px), calc((100% - 1000px) / 2));
	}

	.privacy-heading {
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

	.lede {
		font-size: 16px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
		margin: 10px 0 0;
	}

	.points {
		list-style: none;
		margin: 0;
		/* room for the cards' hard shadow */
		padding: 0 6px 6px 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: clamp(20px, 3vw, 32px);
	}

	.point {
		display: flex;
		flex-direction: column;
		background: var(--surface-card);
		border: 2px solid var(--outline);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		overflow: hidden;
	}

	.visual {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 32px clamp(20px, 4vw, 40px);
		background: var(--accent);
		border-bottom: 2px solid var(--outline);
	}

	.copy {
		padding: 20px clamp(20px, 3vw, 28px) 24px;
	}

	.point-title {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.point-body {
		margin: 6px 0 0;
		font-size: 15px;
		line-height: var(--lh-relaxed);
		color: var(--text-secondary);
	}

	.more {
		text-align: center;
		margin: 28px 0 0;
		font-weight: 700;
	}

	.more a {
		color: var(--text-link);
		text-decoration: none;
	}

	.more a:hover {
		text-decoration: underline var(--plum-500);
		text-underline-offset: 5px;
	}

	.accent-plum {
		--accent: var(--plum-300);
	}

	.accent-coral {
		--accent: var(--coral-300);
	}

	.accent-sage {
		--accent: var(--sage-300);
	}

	.accent-citrus {
		--accent: var(--citrus-300);
	}

	@media (max-width: 720px) {
		.points {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
