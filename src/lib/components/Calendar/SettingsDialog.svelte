<script lang="ts">
	import { enhance } from '$app/forms';
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import TimeInput from '$lib/components/utils/TimeInput.svelte';

	let {
		open,
		settings,
		notifications,
		googleConnected,
		message,
		onclose
	}: {
		open: boolean;
		settings: {
			bufferMinutes: number;
			earliestBookingTime: string;
			latestBookingTime: string;
			weeklySchedule: string[];
		};
		notifications: {
			sendMeetLinks: boolean;
			sendBookingEmails: boolean;
			sendSessionReminderEmails: boolean;
			sendPaymentReminderEmails: boolean;
		};
		googleConnected: boolean;
		message?: string;
		onclose: () => void;
	} = $props();

	let bufferMinutes = $state(settings.bufferMinutes);
	let workStart = $state(settings.earliestBookingTime.slice(0, 5));
	let workEnd = $state(settings.latestBookingTime.slice(0, 5));
	let weeklySchedule = $state([...settings.weeklySchedule]);
	let sendMeetLinks = $state(notifications.sendMeetLinks);
	let sendBookingEmails = $state(notifications.sendBookingEmails);
	let sendSessionReminderEmails = $state(notifications.sendSessionReminderEmails);
	let sendPaymentReminderEmails = $state(notifications.sendPaymentReminderEmails);

	const weekdayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const scheduleKindOptions = [
		{ value: 'online', label: 'Online' },
		{ value: 'in_person', label: 'In Person' },
		{ value: 'off', label: 'Holiday' }
	];
</script>

<Dialog {open} title="Calendar settings" {onclose}>
	<form
		class="settings-form"
		method="POST"
		action="?/updateSettings"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success') onclose();
				await update();
			};
		}}
	>
		<label class="field">
			<span class="field-label">Buffer between sessions (minutes)</span>
			<input
				class="field-input"
				type="number"
				name="bufferMinutes"
				min="0"
				step="5"
				bind:value={bufferMinutes}
			/>
		</label>
		<div class="hours-row">
			<TimeInput label="Working hours from" name="earliestBookingTime" bind:value={workStart} />
			<TimeInput label="Working hours to" name="latestBookingTime" bind:value={workEnd} />
		</div>
		<div class="week-field">
			<span class="field-label">Weekly pattern</span>
			<p class="week-hint">All days default to online sessions unless you change them below.</p>
			<div class="week-list">
				{#each weekdayLabels as label, i (label)}
					<label class="week-row">
						<span class="week-day">{label}</span>
						<select class="field-input" name="weeklySchedule" bind:value={weeklySchedule[i]}>
							{#each scheduleKindOptions as k (k.value)}
								<option value={k.value}>{k.label}</option>
							{/each}
						</select>
					</label>
				{/each}
			</div>
		</div>
		{#if message}
			<div class="form-error">{message}</div>
		{/if}
		<div class="settings-actions">
			<Button type="submit" variant="primary">Save settings</Button>
		</div>
	</form>

	<form
		class="settings-form notifications"
		method="POST"
		action="?/updateNotifications"
		use:enhance={() => {
			return async ({ update }) => update();
		}}
	>
		<span class="field-label">Notifications</span>

		{#if googleConnected}
			<label class="toggle-row">
				<input type="checkbox" name="sendMeetLinks" bind:checked={sendMeetLinks} />
				<span>Add a Google Meet link to online sessions</span>
			</label>
		{:else}
			<p class="week-hint">
				Connect Google Calendar to add a Meet link to online sessions automatically.
			</p>
		{/if}

		<label class="toggle-row">
			<input type="checkbox" name="sendBookingEmails" bind:checked={sendBookingEmails} />
			<span>Email clients when a session is booked, cancelled, or rescheduled</span>
		</label>

		<label class="toggle-row">
			<input
				type="checkbox"
				name="sendSessionReminderEmails"
				bind:checked={sendSessionReminderEmails}
			/>
			<span>Email clients a reminder 24 hours and 1 hour before their session</span>
		</label>

		<label class="toggle-row">
			<input
				type="checkbox"
				name="sendPaymentReminderEmails"
				bind:checked={sendPaymentReminderEmails}
			/>
			<span>Email clients with an outstanding balance a reminder every week</span>
		</label>

		<div class="settings-actions">
			<Button type="submit" variant="primary">Save notifications</Button>
		</div>
	</form>

	{#if !googleConnected}
		<form class="settings-form" method="POST" action="?/connectGoogleCalendar">
			<Button type="submit" variant="secondary">Connect Google Calendar</Button>
		</form>
	{/if}
</Dialog>

<style>
	.settings-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 340px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.field-input {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
	}

	.hours-row {
		display: flex;
		gap: 10px;
	}

	.week-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.week-hint {
		font-size: 12px;
		color: var(--text-muted);
		margin: 0;
	}

	.week-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.week-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.week-day {
		font-size: 13px;
		color: var(--text-primary);
	}

	.week-row .field-input {
		width: 140px;
	}

	.settings-actions {
		display: flex;
		justify-content: flex-end;
	}

	.notifications {
		border-top: 1px solid var(--border-subtle);
		padding-top: 16px;
	}

	.toggle-row {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		font-size: 13px;
		color: var(--text-primary);
	}

	.form-error {
		color: var(--danger, #b3261e);
		font-size: 13px;
	}
</style>