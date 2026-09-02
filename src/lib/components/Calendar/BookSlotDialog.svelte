<script lang="ts">
	import { enhance } from '$app/forms';
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import type { AvailableSlot } from '$lib/server/availability';

	let {
		day,
		year,
		month,
		slots,
		message,
		cancellationPolicy,
		rescheduleAppointmentId,
		onclose
	}: {
		day: number | null;
		year: number;
		month: number;
		slots: AvailableSlot[];
		message?: string;
		cancellationPolicy?: string;
		// when set, picking a slot reschedules this appointment instead of booking a new one
		rescheduleAppointmentId?: string | null;
		onclose: () => void;
	} = $props();

	const title = $derived(
		day !== null
			? new Date(year, month, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
			: ''
	);

	const action = $derived(rescheduleAppointmentId ? '?/rescheduleSession' : '?/bookSession');

	const modalityNote: Record<string, string> = {
		online: 'This is an online day.',
		in_person: 'This is an in-person day.'
	};
</script>

<Dialog open={day !== null} {title} {onclose}>
	<div class="slot-list">
		{#if slots.length > 0}
			<div class="modality-note">{modalityNote[slots[0].modality]}</div>
		{/if}
		{#if slots.length === 0}
			<div class="empty">No open times left on this day.</div>
		{/if}
		{#each slots as slot (slot.startTime)}
			<form
				method="POST"
				{action}
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') onclose();
						await update();
					};
				}}
			>
				<input type="hidden" name="year" value={year} />
				<input type="hidden" name="month" value={month} />
				<input type="hidden" name="day" value={day} />
				<input type="hidden" name="startTime" value={slot.startTime} />
				{#if rescheduleAppointmentId}
					<input type="hidden" name="appointmentId" value={rescheduleAppointmentId} />
				{/if}
				<button type="submit" class="slot-btn">{slot.label}</button>
			</form>
		{/each}
		{#if message}
			<div class="form-error">{message}</div>
		{/if}
		{#if cancellationPolicy}
			<div class="policy-note">{cancellationPolicy}</div>
		{/if}
	</div>
</Dialog>

<style>
	.slot-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 260px;
	}

	.slot-btn {
		width: 100%;
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		background: var(--surface-card);
		color: var(--text-primary);
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
	}

	.slot-btn:hover {
		background: var(--sage-300);
	}

	.empty {
		color: var(--text-muted);
		font-size: 14px;
		padding: 8px 0;
	}

	.modality-note {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 4px;
	}

	.form-error {
		color: var(--danger, #b3261e);
		font-size: 13px;
	}

	.policy-note {
		color: var(--text-muted);
		font-size: 12px;
		padding-top: 4px;
	}
</style>