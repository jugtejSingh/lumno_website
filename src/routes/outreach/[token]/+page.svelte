<script lang="ts">
	import Logo from '$lib/components/utils/Logo.svelte';
	import Card from '$lib/components/utils/Card.svelte';
	import PortalMonthGrid from '$lib/components/Calendar/PortalMonthGrid.svelte';
	import DiscoveryCallDialog from '$lib/components/Calendar/DiscoveryCallDialog.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let bookDay = $state<number | null>(null);
	let booked = $state(false);

	const bookSlots = $derived(bookDay !== null ? (data.slotsByDay[bookDay] ?? []) : []);
	const monthLabel = $derived(
		new Date(data.year, data.month, 1).toLocaleDateString('en-US', {
			month: 'long',
			year: 'numeric'
		})
	);

	function gotoMonth(year: number, month: number) {
		goto(`?year=${year}&month=${month}`, { keepFocus: true, noScroll: true });
	}

	function prevMonth() {
		if (data.month === 0) {
			gotoMonth(data.year - 1, 11);
		} else {
			gotoMonth(data.year, data.month - 1);
		}
	}

	function nextMonth() {
		if (data.month === 11) {
			gotoMonth(data.year + 1, 0);
		} else {
			gotoMonth(data.year, data.month + 1);
		}
	}

	function handleBooked() {
		bookDay = null;
		booked = true;
		invalidateAll();
	}
</script>

<svelte:head>
	<title>Book a discovery call — {data.therapistName}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page">
	<div class="header"><Logo /></div>

	<main class="content">
		<h1 class="title">Book a discovery call with {data.therapistName}</h1>
		<p class="sub">
			Pick a day that suits you, choose a time, and tell us a little about yourself. You'll get a
			confirmation email straight away.
		</p>

		{#if booked}
			<Card>
				<div class="success">
					<div class="success-title">You're booked in</div>
					<div>
						We've emailed you the details. If you don't see it in a minute or two, check your spam
						folder.
					</div>
				</div>
			</Card>
		{:else}
			<Card>
				<div class="book-toolbar">
					<div class="month-label">{monthLabel}</div>
					<div class="month-arrows">
						<button class="arrow-btn" onclick={prevMonth} aria-label="Previous month">&#8249;</button>
						<button class="arrow-btn" onclick={nextMonth} aria-label="Next month">&#8250;</button>
					</div>
				</div>
				<PortalMonthGrid
					year={data.year}
					month={data.month}
					slotsByDay={data.slotsByDay}
					onDayClick={(day) => (bookDay = day)}
				/>
			</Card>
		{/if}
	</main>
</div>

<DiscoveryCallDialog
	day={bookDay}
	year={data.year}
	month={data.month}
	slots={bookSlots}
	message={form?.message}
	onbooked={handleBooked}
	onclose={() => (bookDay = null)}
/>

<style>
	.page {
		min-height: 100vh;
		background: var(--surface-canvas);
	}

	.header {
		padding: 20px clamp(16px, 4vw, 32px);
	}

	.content {
		max-width: 720px;
		margin: 0 auto;
		padding: 0 16px 48px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.title {
		font-family: var(--font-display);
		font-size: clamp(22px, 5vw, 30px);
		color: var(--text-primary);
		margin: 0;
	}

	.sub {
		margin: 0;
		color: var(--text-secondary);
		font-size: 15px;
		line-height: var(--lh-relaxed);
	}

	.success {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
		color: var(--text-secondary);
	}

	.success-title {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.book-toolbar {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 12px;
	}

	.month-label {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(18px, 4vw, 20px);
		color: var(--text-primary);
	}

	.month-arrows {
		display: flex;
		gap: 6px;
	}

	.arrow-btn {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		border: 2px solid var(--border-subtle);
		box-shadow: var(--shadow-xs);
		background: var(--surface-card);
		cursor: pointer;
		font-size: 14px;
		line-height: 1;
	}
</style>
