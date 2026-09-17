<script lang="ts">
	// Tappable "i" that opens an explanation card. Native popover: works on touch,
	// closes on Esc / outside click, sits in the top layer so no z-index fights.
	// ponytail: card is centred on screen rather than anchored to the button —
	// CSS anchor positioning isn't in every browser yet.
	let { text, label = 'More info' }: { text: string; label?: string } = $props();

	const id = $props.id();
</script>

<button
	type="button"
	class="info-btn"
	popovertarget={id}
	aria-label={label}>i</button
>
<!-- spans, not divs: this usually renders inside a field's <label><span> -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<span
	{id}
	popover
	class="info-card"
	onclick={(e) => {
		// inside a <label>, a click on the card text would otherwise toggle/focus the field
		if (!(e.target instanceof HTMLButtonElement)) {
			e.preventDefault();
		}
	}}
>
	<span class="info-title">{label}</span>
	<span class="info-text">{text}</span>
	<button type="button" class="info-close" popovertarget={id} popovertargetaction="hide">Got it</button>
</span>

<style>
	.info-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		margin-left: 6px;
		padding: 0;
		vertical-align: middle;
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		background: var(--surface-card);
		color: var(--outline);
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 700;
		font-style: italic;
		line-height: 1;
		cursor: pointer;
	}

	.info-btn:hover,
	.info-btn:focus-visible {
		background: var(--coral-100);
		outline: none;
		box-shadow: var(--shadow-focus);
	}

	.info-card {
		width: min(360px, calc(100vw - 32px));
		padding: 16px;
		border: 2px solid var(--outline);
		border-radius: var(--radius-md);
		background: var(--surface-card);
		color: var(--text-primary);
		box-shadow: var(--shadow-md);
	}

	.info-card::backdrop {
		background: rgb(53 25 14 / 0.25);
	}

	.info-title {
		display: block;
		font-size: 14px;
		font-weight: 700;
		margin-bottom: 6px;
	}

	.info-text {
		display: block;
		margin: 0 0 12px;
		font-size: 14px;
		font-weight: 400;
		line-height: var(--lh-relaxed);
		white-space: pre-line;
	}

	.info-close {
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 600;
		padding: 6px 14px;
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		background: var(--coral-100);
		color: var(--text-primary);
		cursor: pointer;
	}
</style>