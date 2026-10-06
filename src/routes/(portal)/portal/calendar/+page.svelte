<script lang="ts">
	import { goto } from '$app/navigation';
	import PortalSessionList from '$lib/components/Portal/PortalSessionList.svelte';
	import PortalMonthGrid from '$lib/components/Calendar/PortalMonthGrid.svelte';
	import BookSlotDialog from '$lib/components/Calendar/BookSlotDialog.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let bookDay = $state<number | null>(null);
	// lives in the URL (?reschedule=) so the load can leave the session being moved out of
	// the day's max-sessions count — see +page.server.ts
	const rescheduleId = $derived(data.rescheduleId);

	const bookSlots = $derived(bookDay !== null ? (data.slotsByDay[bookDay] ?? []) : []);

	function closeBookDialog() {
		bookDay = null;
		if (rescheduleId !== null) {
			setReschedule(null);
		}
	}

	const monthLabel = $derived(
		new Date(data.year, data.month, 1).toLocaleDateString('en-US', {
			month: 'long',
			year: 'numeric'
		})
	);

	function bookingUrl(year: number, month: number, reschedule: string | null): string {
		let url = `?year=${year}&month=${month}`;
		if (reschedule !== null) {
			url += `&reschedule=${reschedule}`;
		}
		return url;
	}

	function gotoMonth(nextYear: number, nextMonth: number) {
		goto(bookingUrl(nextYear, nextMonth, rescheduleId), { keepFocus: true });
	}

	function setReschedule(appointmentId: string | null) {
		goto(bookingUrl(data.year, data.month, appointmentId), { keepFocus: true, noScroll: true });
	}

	function prevMonth() {
		gotoMonth(data.month === 0 ? data.year - 1 : data.year, data.month === 0 ? 11 : data.month - 1);
	}

	function nextMonth() {
		gotoMonth(
			data.month === 11 ? data.year + 1 : data.year,
			data.month === 11 ? 0 : data.month + 1
		);
	}
</script>

<div class="section">
	{#if data.sessions.length > 0}
		<div class="section-title">Your sessions</div>
	{/if}
	<PortalSessionList
		sessions={data.sessions}
		therapistName={data.therapistName}
		onreschedule={setReschedule}
	/>
	{#if rescheduleId}
		<div class="reschedule-banner">
			Pick a new time below for your session.
			<button type="button" class="reschedule-cancel" onclick={() => setReschedule(null)}
				>Cancel</button
			>
		</div>
	{/if}

	{#if data.bookingNote}
		<div class="booking-note">{data.bookingNote}</div>
	{/if}
	{#if data.packRemaining !== null}
		<div class="hint">
			{#if data.packRemaining === 1}
				1 session remaining in your pack.
			{:else}
				{data.packRemaining} sessions remaining in your pack.
			{/if}
		</div>
	{:else if data.packUsedUp}
		<div class="hint">
			Your session pack is used up. Contact {data.therapistName} to buy another pack, or go ahead and
			book a session at the regular price.
		</div>
	{/if}

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
	<div class="hint">{data.cancellationPolicy}</div>
	<div class="hint">{data.reschedulePolicy}</div>
</div>

<BookSlotDialog
	day={bookDay}
	year={data.year}
	month={data.month}
	slots={bookSlots}
	message={form?.message}
	cancellationPolicy={rescheduleId ? data.reschedulePolicy : data.cancellationPolicy}
	rescheduleAppointmentId={rescheduleId}
	onclose={closeBookDialog}
/>

<style>
	.section {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-width: 760px;
	}

	.section-title {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.hint {
		font-size: 13px;
		color: var(--text-muted);
	}

	/* plain text from the therapist; pre-wrap keeps their line breaks */
	.booking-note {
		font-size: 14px;
		color: var(--text-primary);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		background: var(--surface-card);
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
	}

	.book-toolbar {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-top: 6px;
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

	.reschedule-banner {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary);
		background: var(--citrus-300);
		border: 2px dashed var(--citrus-600);
		border-radius: var(--radius-md, 8px);
		padding: 10px 14px;
	}

	.reschedule-cancel {
		border: none;
		background: none;
		color: var(--text-link);
		font-weight: 700;
		cursor: pointer;
		padding: 0;
	}
</style>
