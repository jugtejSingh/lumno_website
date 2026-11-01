<script lang="ts">
	import type { Testimonial } from '$lib/types/home';

	let { testimonials }: { testimonials: Testimonial[] } = $props();

	function initials(name: string): string {
		let letters = '';
		for (const word of name.split(' ')) {
			if (word.length > 0) {
				letters = letters + word[0].toUpperCase();
			}
		}
		return letters.slice(0, 2);
	}
</script>

{#if testimonials.length > 0}
	<section id="testimonials" class="testimonials">
		<div class="testimonials-heading">
			<h2 class="display">Don't take our word for it</h2>
			<p class="lede">Look at what therapists have to say.</p>
		</div>

		<ul class="grid">
			{#each testimonials as testimonial, i (i)}
				<li class="card accent-{testimonial.accent}">
					<blockquote class="quote">“{testimonial.quote}”</blockquote>
					<div class="person">
						{#if testimonial.image}
							<img class="avatar" src={testimonial.image} alt="" width="48" height="48" />
						{:else}
							<span class="avatar initials" aria-hidden="true">{initials(testimonial.name)}</span>
						{/if}
						<div>
							<a
								class="name"
								href="https://www.instagram.com/{testimonial.instagram}/"
								target="_blank"
								rel="noopener noreferrer"
							>
								{testimonial.name}
							</a>
							<p class="about">{testimonial.about}</p>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.testimonials {
		padding: clamp(40px, 6vw, 64px) max(clamp(16px, 5vw, 48px), calc((100% - 1200px) / 2));
		background: var(--citrus-300);
		border-top: 2px solid var(--outline);
		border-bottom: 2px solid var(--outline);
	}

	.testimonials-heading {
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

	.grid {
		list-style: none;
		margin: 0;
		/* room for the cards' hard shadow */
		padding: 0 6px 6px 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
		gap: 24px;
	}

	.card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 20px;
		background: var(--surface-card);
		border: 2px solid var(--outline);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		padding: clamp(20px, 3vw, 28px);
	}

	.quote {
		margin: 0;
		font-size: 16px;
		line-height: var(--lh-relaxed);
		color: var(--text-primary);
	}

	.person {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.avatar {
		width: 48px;
		height: 48px;
		flex-shrink: 0;
		border-radius: 50%;
		border: 2px solid var(--outline);
		object-fit: cover;
	}

	.initials {
		display: grid;
		place-items: center;
		box-sizing: border-box;
		font-weight: 700;
		background: var(--accent);
		color: var(--text-primary);
	}

	.name {
		font-weight: 700;
		color: var(--text-primary);
	}

	.about {
		margin: 2px 0 0;
		font-size: 14px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
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
</style>
