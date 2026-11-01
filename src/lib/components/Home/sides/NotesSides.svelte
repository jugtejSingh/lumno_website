<script lang="ts">
	import type { Face } from './face';

	let { face }: { face: Face } = $props();
</script>

{#if face === 'you'}
	<div class="title">Session notes · Priya</div>
	<div class="note raw">
		doing better. sleep improving ~6/10. went over breathing again. hw journal 3x
	</div>
	<div class="fix">✨ Fix wording</div>
	<div class="note clean">
		Priya reports feeling better, with sleep improving to around 6/10. We revisited the breathing
		exercise. Homework: journal three times this week.
	</div>
	<p class="caption">
		Type or dictate however it comes out. AI only tidies it when you press the button.
	</p>
{:else}
	<div class="title">Your session recap · 23 Oct</div>
	<div class="note clean">
		We talked about how your sleep has been getting better, and practised the breathing exercise
		together again.
	</div>
	<div class="homework">
		<span class="chip chip-citrus">This week</span>
		Journal three times
	</div>
	<p class="caption">
		Your client gets a gentle recap when you choose to send one. Your private notes stay private.
	</p>
{/if}

<style>
	.note {
		border: 2px solid var(--outline);
		border-radius: var(--radius-md);
		padding: 14px 16px;
		font-size: 15px;
		line-height: var(--lh-relaxed);
	}

	.raw {
		border-style: dashed;
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text-muted);
	}

	.clean {
		background: var(--surface-card);
		box-shadow: var(--shadow-sm);
	}

	.fix {
		display: inline-block;
		margin: 12px 0;
		font-size: 13px;
		font-weight: 700;
		background: var(--plum-300);
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		box-shadow: var(--shadow-xs);
		padding: 4px 12px;
	}

	.homework {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 12px;
		font-weight: 600;
		font-size: 15px;
	}
</style>
