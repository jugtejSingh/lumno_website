<script lang="ts">
	import { enhance } from '$lib/enhance';
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import Card from '$lib/components/utils/Card.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import AddAppointmentForm from './AddAppointmentForm.svelte';
	import RescheduleAppointmentForm from './RescheduleAppointmentForm.svelte';
	import type { CalendarSession } from '$lib/types/calendar';

	let {
		day,
		year,
		month,
		sessions,
		clients,
		formMessage,
		onclose
	}: {
		day: number | null;
		year: number;
		month: number;
		sessions: CalendarSession[];
		clients: { id: string; name: string }[];
		formMessage?: string;
		onclose: () => void;
	} = $props();

	// only meaningful while the dialog is open, so it's local rather than lifted to the page
	let addApptOpen = $state(false);
	let rescheduleSessionId = $state<string | null>(null);
	// which completed session (if any) has its "how much to charge" picker open
	let feePickerId = $state<string | null>(null);

	const title = $derived(
		day !== null
			? new Date(year, month, day).toLocaleDateString('en-US', {
					month: 'long',
					day: 'numeric',
					year: 'numeric'
				})
			: ''
	);

	function close() {
		addApptOpen = false;
		rescheduleSessionId = null;
		feePickerId = null;
		onclose();
	}
</script>

<Dialog open={day !== null} {title} onclose={close}>
	<div class="dialog-list">
		{#each sessions as s (s.id)}
			<Card>
				{#if rescheduleSessionId === s.id && day !== null}
					<RescheduleAppointmentForm
						{year}
						{month}
						{day}
						session={s}
						message={formMessage}
						onCancel={() => (rescheduleSessionId = null)}
						onSuccess={() => (rescheduleSessionId = null)}
					/>
				{:else}
					{@const inert = s.status === 'cancelled' || s.status === 'rescheduled'}
					<div class="dialog-row" class:inert>
						<Avatar name={s.name} size={34} />
						<div class="dialog-info">
							<div class="dialog-name">{s.name}</div>
							<div class="dialog-time">{s.time}</div>
							{#if s.notes}
								<div class="dialog-notes">{s.notes}</div>
							{/if}
							{#if s.meetLink && s.status === 'confirmed'}
								<a class="dialog-meet" href={s.meetLink} target="_blank" rel="noreferrer">Join Google Meet</a>
							{/if}
						</div>
						{#if s.status === 'cancelled'}
							<Tag color="beige">cancelled</Tag>
						{:else if s.status === 'rescheduled'}
							<Tag color="beige">moved</Tag>
						{:else if s.status === 'completed'}
							<Tag color="sage">completed</Tag>
						{:else}
							<Tag color="sage">reminder set</Tag>
						{/if}
					</div>

					{#if s.status === 'confirmed'}
						<div class="dialog-actions">
							<Button variant="secondary" size="sm" onclick={() => (rescheduleSessionId = s.id)}>
								Reschedule
							</Button>
							<form
								method="POST"
								action="?/cancelAppointment"
								use:enhance={() => {
									return async ({ update }) => update();
								}}
							>
								<input type="hidden" name="appointmentId" value={s.id} />
								<Button type="submit" variant="secondary" size="sm">Cancel session</Button>
							</form>
						</div>
					{:else if s.status === 'completed'}
						{#if feePickerId === s.id}
							<form
								class="fee-picker"
								method="POST"
								action="?/cancelAppointment"
								use:enhance={() => {
									return async ({ update }) => {
										feePickerId = null;
										await update();
									};
								}}
							>
								<input type="hidden" name="appointmentId" value={s.id} />
								<div class="fee-prompt">This session already happened — how much do you want to charge {s.name}?</div>
								<div class="fee-options">
									<button class="fee-btn" type="submit" name="chargeTier" value="free">Charge 0%</button>
									<button class="fee-btn" type="submit" name="chargeTier" value="partial">Charge 50%</button>
									<button class="fee-btn" type="submit" name="chargeTier" value="full">Charge 100%</button>
								</div>
								<button class="fee-back" type="button" onclick={() => (feePickerId = null)}>Keep session</button>
							</form>
						{:else}
							<div class="dialog-actions">
								<Button variant="secondary" size="sm" onclick={() => (feePickerId = s.id)}>Cancel session</Button>
							</div>
						{/if}
					{/if}
				{/if}
			</Card>
		{/each}
		{#if sessions.length === 0}
			<div class="empty">No sessions booked. Enjoy the quiet.</div>
		{/if}

		{#if addApptOpen && day !== null}
			<AddAppointmentForm
				{year}
				{month}
				{day}
				{clients}
				message={formMessage}
				onCancel={() => (addApptOpen = false)}
				onSuccess={() => (addApptOpen = false)}
			/>
		{:else}
			<Button variant="secondary" onclick={() => (addApptOpen = true)}>+ Add appointment</Button>
		{/if}
	</div>
</Dialog>

<style>
	.dialog-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 320px;
	}

	.dialog-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.dialog-info {
		flex: 1;
	}

	.dialog-name {
		font-weight: 700;
	}

	.dialog-time {
		font-size: 13px;
		color: var(--text-muted);
	}

	.dialog-notes {
		font-size: 13px;
		color: var(--text-secondary);
		margin-top: 2px;
		white-space: pre-wrap;
	}

	.dialog-meet {
		display: inline-block;
		font-size: 13px;
		color: var(--sage-600, var(--text-primary));
		margin-top: 4px;
	}

	.dialog-actions {
		display: flex;
		gap: 8px;
		margin-top: 10px;
	}

	.dialog-row.inert {
		opacity: 0.55;
	}

	.fee-picker {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 10px;
	}

	.fee-prompt {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.fee-options {
		display: flex;
		gap: 8px;
	}

	.fee-btn {
		flex: 1;
		padding: 6px 10px;
		font-size: 13px;
		font-weight: 700;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		background: var(--surface-card);
		color: var(--text-primary);
		cursor: pointer;
	}

	.fee-btn:hover {
		background: var(--surface-canvas);
	}

	.fee-back {
		align-self: flex-start;
		padding: 2px 0;
		font-size: 12px;
		color: var(--text-muted);
		background: none;
		border: none;
		cursor: pointer;
	}

	.empty {
		color: var(--text-muted);
		font-size: 14px;
		padding: 8px 0;
	}
</style>