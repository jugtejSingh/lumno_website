<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$lib/enhance';
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import DayRail from './DayRail.svelte';
	import HolidayToggle from './HolidayToggle.svelte';
	import DaySlotsEditor from './DaySlotsEditor.svelte';
	import MaxSessionsInput from './MaxSessionsInput.svelte';
	import ReservedSlotChangeDialog from './ReservedSlotChangeDialog.svelte';
	import type { ReservedSlotChange, WeeklyDay } from '$lib/types/slots';

	// mounted only while open (see calendar +page.svelte), so the draft is seeded fresh each time
	let {
		week,
		clients,
		message,
		onclose
	}: {
		week: WeeklyDay[]; // index 0 = Sunday
		clients: { id: string; name: string }[];
		message?: string;
		onclose: () => void;
	} = $props();

	let draft = $state(untrack(() => $state.snapshot(week)));

	let formElement: HTMLFormElement;
	// reserved slots this save would edit or remove; non-empty = the warning modal is showing
	let pendingChanges = $state<ReservedSlotChange[]>([]);
	// set when the therapist confirms the warning, so the re-submit goes straight through
	let confirmedSave = false;

	// listed Monday-first, stored Sunday-first
	const dayOrder = [
		{ weekday: 1, name: 'Monday' },
		{ weekday: 2, name: 'Tuesday' },
		{ weekday: 3, name: 'Wednesday' },
		{ weekday: 4, name: 'Thursday' },
		{ weekday: 5, name: 'Friday' },
		{ weekday: 6, name: 'Saturday' },
		{ weekday: 0, name: 'Sunday' }
	];

	let selected = $state(1);

	const selectedName = $derived.by(() => {
		for (const day of dayOrder) {
			if (day.weekday === selected) {
				return day.name;
			}
		}
		return '';
	});

	function nameOfWeekday(weekday: number): string {
		for (const day of dayOrder) {
			if (day.weekday === weekday) {
				return day.name;
			}
		}
		return '';
	}

	function nameOfClient(clientId: string): string {
		for (const client of clients) {
			if (client.id === clientId) {
				return client.name;
			}
		}
		return 'A client';
	}

	// Compares the stored reserved slots (`week`, which refreshes after a reservation is made)
	// with the draft: a reserved slot that is gone, or moved/retimed/retyped, is a change.
	function findReservedChanges(): ReservedSlotChange[] {
		const draftById = new Map<string, { weekday: number; startTime: string; endTime: string; modality: string }>();
		for (let weekday = 0; weekday < 7; weekday++) {
			for (const slot of draft[weekday].slots) {
				if (slot.id) {
					draftById.set(slot.id, {
						weekday,
						startTime: slot.startTime,
						endTime: slot.endTime,
						modality: slot.modality
					});
				}
			}
		}

		const changes: ReservedSlotChange[] = [];
		for (let weekday = 0; weekday < 7; weekday++) {
			for (const original of week[weekday].slots) {
				if (!original.id || !original.reservedClientId) {
					continue;
				}
				const current = draftById.get(original.id);
				let kind: ReservedSlotChange['kind'] | null = null;
				if (!current) {
					kind = 'removed';
				} else if (
					current.weekday !== weekday ||
					current.startTime !== original.startTime ||
					current.endTime !== original.endTime ||
					current.modality !== original.modality
				) {
					kind = 'changed';
				}
				if (kind !== null) {
					changes.push({
						clientName: nameOfClient(original.reservedClientId),
						weekdayName: nameOfWeekday(weekday),
						time: `${original.startTime}–${original.endTime}`,
						kind
					});
				}
			}
		}
		return changes;
	}

	function confirmSave() {
		confirmedSave = true;
		pendingChanges = [];
		formElement.requestSubmit();
	}

	// holidays don't count: nothing on them can be booked
	const bookableSlotCount = $derived.by(() => {
		let total = 0;
		for (const day of draft) {
			if (!day.holiday) {
				total += day.slots.length;
			}
		}
		return total;
	});

	// copies slots and max sessions; each target day keeps its own holiday setting
	function copyDay(fromWeekday: number, target: string) {
		const targets: number[] = [];
		if (target === 'all') {
			for (let weekday = 0; weekday < 7; weekday++) {
				targets.push(weekday);
			}
		} else if (target === 'weekdays') {
			for (let weekday = 1; weekday <= 5; weekday++) {
				targets.push(weekday);
			}
		} else {
			targets.push(Number(target));
		}

		const source = $state.snapshot(draft[fromWeekday]);
		for (const weekday of targets) {
			if (weekday !== fromWeekday) {
				// copies are new slots: they must not carry the source slot's id or reservation
				const copies = structuredClone(source.slots);
				for (const copy of copies) {
					delete copy.id;
					delete copy.reservedClientId;
				}
				draft[weekday].slots = copies;
				draft[weekday].maxSessions = source.maxSessions;
			}
		}
	}
</script>

<Dialog open={true} title="Your weekly slots" width="clamp(320px, 70vw, 720px)" flush {onclose}>
	<form
		class="week-form"
		method="POST"
		action="?/saveWeekTemplate"
		bind:this={formElement}
		use:enhance={({ cancel }) => {
			if (!confirmedSave) {
				const changes = findReservedChanges();
				if (changes.length > 0) {
					pendingChanges = changes;
					cancel();
					return;
				}
			}
			confirmedSave = false;
			return async ({ result, update }) => {
				if (result.type === 'success') {
					onclose();
				}
				await update();
			};
		}}
	>
		<input type="hidden" name="week" value={JSON.stringify(draft)} />

		<DayRail days={dayOrder} week={draft} bind:selected />

		<div class="day-pane">
			<div class="day-header">
				<h3 class="day-name">{selectedName}</h3>
				<HolidayToggle bind:holiday={draft[selected].holiday} dayName={selectedName} />
			</div>

			<div class="day-scroll">
				{#if draft[selected].holiday}
					<p class="holiday-note">
						Holiday — clients can’t book any {selectedName}. The slots below are kept for when you
						switch it back. Dates you’ve edited on the calendar still use their own slots.
					</p>
				{/if}

				<div class="day-body" class:on-holiday={draft[selected].holiday}>
					<DaySlotsEditor bind:slots={draft[selected].slots} {clients} />

					<div class="day-tools">
						{#if draft[selected].slots.length > 0}
							<MaxSessionsInput bind:value={draft[selected].maxSessions} />
							<select
								class="copy-select"
								aria-label="Copy {selectedName} to other days"
								value=""
								onchange={(event) => {
									copyDay(selected, event.currentTarget.value);
									event.currentTarget.value = '';
								}}
							>
								<option value="" disabled>Copy to…</option>
								<option value="weekdays">Mon – Fri</option>
								<option value="all">Every day</option>
								{#each dayOrder as other (other.weekday)}
									{#if other.weekday !== selected}
										<option value={other.weekday}>{other.name}</option>
									{/if}
								{/each}
							</select>
						{/if}
					</div>
				</div>
			</div>

			{#if message}
				<div class="form-error">{message}</div>
			{/if}

			<div class="footer">
				<span class="summary">
					{#if bookableSlotCount === 1}
						1 bookable slot a week
					{:else}
						{bookableSlotCount} bookable slots a week
					{/if}
				</span>
				<div class="actions">
					<Button type="button" variant="secondary" onclick={onclose}>Cancel</Button>
					<Button type="submit" variant="primary">Save</Button>
				</div>
			</div>
		</div>
	</form>
</Dialog>

{#if pendingChanges.length > 0}
	<ReservedSlotChangeDialog
		changes={pendingChanges}
		onconfirm={confirmSave}
		oncancel={() => (pendingChanges = [])}
	/>
{/if}

<style>
	/* one height whichever day is picked, never taller than the screen */
	.week-form {
		display: flex;
		flex: 0 1 600px;
		min-height: 0;
	}

	.day-pane {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	/* the day and its holiday toggle stay put while the slots scroll under them */
	.day-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 18px;
	}

	.day-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 0 18px 18px;
	}

	.day-name {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 20px;
		color: var(--text-primary);
	}

	.holiday-note {
		margin: 0;
		padding: 8px 12px;
		border: 2px dashed var(--outline);
		border-radius: var(--radius-sm);
		background: var(--warning-bg);
		font-size: 13px;
		color: var(--text-secondary);
	}

	.day-body {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	/* still editable, just visibly not in use */
	.day-body.on-holiday {
		opacity: 0.55;
	}

	.day-tools {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
	}

	.copy-select {
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-weight: 700;
		text-transform: uppercase;
		padding: 5px 10px;
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		background: var(--surface-card);
		color: var(--text-muted);
		cursor: pointer;
	}

	/* Cancel and Save stay reachable however long the day is */
	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 12px;
		padding: 12px 18px;
		border-top: 2px solid var(--outline);
		background: var(--surface-card);
	}

	.summary {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-muted);
	}

	.actions {
		display: flex;
		gap: 8px;
	}

	.form-error {
		padding: 0 18px;
		color: var(--danger);
		font-size: 13px;
	}

	@media (max-width: 620px) {
		.week-form {
			flex-direction: column;
		}

		.day-header {
			padding: 12px 16px;
		}

		.day-scroll {
			padding: 0 16px 16px;
		}

		.footer {
			padding: 10px 16px;
		}

		.form-error {
			padding: 0 16px;
		}
	}
</style>
