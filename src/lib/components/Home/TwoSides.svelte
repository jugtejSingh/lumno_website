<script lang="ts">
	import type { Component } from 'svelte';
	import BookingsSides from './sides/BookingsSides.svelte';
	import PaymentsSides from './sides/PaymentsSides.svelte';
	import NotesSides from './sides/NotesSides.svelte';
	import RemindersSides from './sides/RemindersSides.svelte';
	import RulesSides from './sides/RulesSides.svelte';
	import type { Face } from './sides/face';

	type Tab = { id: string; label: string; sides: Component<{ face: Face }> };

	const tabs: Tab[] = [
		{ id: 'bookings', label: 'Bookings', sides: BookingsSides },
		{ id: 'payments', label: 'Payments', sides: PaymentsSides },
		{ id: 'notes', label: 'Notes', sides: NotesSides },
		{ id: 'reminders', label: 'Reminders', sides: RemindersSides },
		{ id: 'rules', label: 'Your rules', sides: RulesSides }
	];

	let activeId = $state('bookings');
	let showClient = $state(false);

	const activeTab = $derived.by(() => {
		for (const tab of tabs) {
			if (tab.id === activeId) {
				return tab;
			}
		}
		return tabs[0];
	});

	function toggleSide() {
		showClient = !showClient;
	}
</script>

<div class="board">
	<div class="tabs" role="tablist" aria-label="Lumno features">
		{#each tabs as tab (tab.id)}
			<button
				type="button"
				role="tab"
				id="tab-{tab.id}"
				aria-selected={tab.id === activeId}
				aria-controls="two-sides-panel"
				class="tab"
				class:active={tab.id === activeId}
				onclick={() => (activeId = tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<div class="stage">
		<div class="switch-row">
			<span class="side-label" class:current={!showClient}>You</span>
			<button
				type="button"
				role="switch"
				aria-checked={showClient}
				aria-label="Show your client's view"
				class="switch"
				class:on={showClient}
				onclick={toggleSide}
			>
				<span class="knob"></span>
			</button>
			<span class="side-label" class:current={showClient}>Your client</span>
		</div>

		<div
			id="two-sides-panel"
			role="tabpanel"
			aria-labelledby="tab-{activeTab.id}"
			class="flipper"
			class:flipped={showClient}
		>
			<div class="face front" inert={showClient}>
				<activeTab.sides face="you" />
			</div>
			<div class="face back" inert={!showClient}>
				<activeTab.sides face="client" />
			</div>
		</div>
	</div>
</div>

<style>
	.board {
		width: 100%;
	}

	.tabs {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
		margin-bottom: 16px;
	}

	.tab {
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		box-shadow: var(--shadow-xs);
		padding: 6px 14px;
		cursor: pointer;
		transition:
			transform var(--duration-fast) var(--ease-out),
			box-shadow var(--duration-fast) var(--ease-out);
	}

	.tab:hover {
		transform: translate(-1px, -1px);
		box-shadow: var(--shadow-sm);
	}

	.tab.active {
		background: var(--plum-300);
		box-shadow: var(--shadow-md);
	}

	.switch-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin-bottom: 20px;
		font-weight: 700;
	}

	.side-label {
		color: var(--text-muted);
		transition: color var(--duration-fast);
	}

	.side-label.current {
		color: var(--text-primary);
	}

	.switch {
		width: 64px;
		height: 34px;
		padding: 0;
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		background: var(--plum-300);
		box-shadow: var(--shadow-xs);
		position: relative;
		cursor: pointer;
		transition: background var(--duration-base);
	}

	.switch.on {
		background: var(--sage-300);
	}

	.knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--surface-card);
		border: 2px solid var(--outline);
		transition: transform var(--duration-base) var(--ease-out);
	}

	.switch.on .knob {
		transform: translateX(30px);
	}

	.flipper {
		display: grid;
		transform-style: preserve-3d;
		transform: perspective(1600px) rotateY(0deg);
		transition: transform 700ms var(--ease-standard);
	}

	.flipper.flipped {
		transform: perspective(1600px) rotateY(180deg);
	}

	/* both faces share one grid cell so the card is as tall as the taller face */
	.face {
		grid-area: 1 / 1;
		backface-visibility: hidden;
		background: var(--surface-card);
		border: 2px solid var(--outline);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: clamp(18px, 3vw, 28px);
	}

	.back {
		transform: rotateY(180deg);
		background: var(--beige-50);
	}

	/* shared by every sides/* face */
	.face :global(.title) {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 22px;
		margin-bottom: 16px;
	}

	.face :global(.caption) {
		margin: 16px 0 0;
		font-size: 14px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
	}

	.face :global(.row) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border: 2px solid var(--outline);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
		padding: 10px 14px;
		font-size: 14px;
		font-weight: 600;
	}

	.face :global(.rows) {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.face :global(.muted) {
		color: var(--text-muted);
		font-weight: 500;
		font-size: 13px;
	}

	.face :global(.chip) {
		font-size: 12px;
		font-weight: 700;
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		padding: 2px 10px;
		white-space: nowrap;
	}

	.face :global(.chip-sage) {
		background: var(--sage-300);
	}

	.face :global(.chip-citrus) {
		background: var(--citrus-300);
	}

	.face :global(.chip-coral) {
		background: var(--coral-300);
	}

	.face :global(.chip-plum) {
		background: var(--plum-300);
	}

	@media (prefers-reduced-motion: reduce) {
		.flipper {
			transition: none;
		}
	}
</style>
