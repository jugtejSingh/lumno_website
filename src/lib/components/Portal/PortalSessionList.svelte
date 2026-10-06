<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import RescheduleChargeDialog from '$lib/components/Calendar/RescheduleChargeDialog.svelte';
	import { enhance } from '$lib/enhance';

	// The client's upcoming sessions with Reschedule / Cancel. Cancel posts to
	// ?/cancelSession on whichever page this sits on; Reschedule hands the id to the page,
	// after the regular-rate charge warning when that applies.
	let {
		sessions,
		therapistName,
		onreschedule
	}: {
		sessions: {
			id: string;
			when: string;
			type: string;
			status: string;
			tone: 'success';
			meetLink: string | null;
			rescheduleChargesRegularRate: boolean;
		}[];
		therapistName: string;
		onreschedule: (appointmentId: string) => void;
	} = $props();

	let pendingRescheduleId = $state<string | null>(null);

	function requestReschedule(appointmentId: string, chargesRegularRate: boolean) {
		if (chargesRegularRate) {
			pendingRescheduleId = appointmentId;
			return;
		}
		onreschedule(appointmentId);
	}

	function confirmPendingReschedule() {
		const appointmentId = pendingRescheduleId;
		pendingRescheduleId = null;
		if (appointmentId !== null) {
			onreschedule(appointmentId);
		}
	}
</script>

{#each sessions as s (s.id)}
	<Card>
		<div class="row">
			<Avatar name={therapistName} size={36} />
			<div class="row-info">
				<div class="row-title">{s.when}</div>
				<div class="row-sub">{s.type}</div>
				{#if s.meetLink}
					<a class="row-meet" href={s.meetLink} target="_blank" rel="noreferrer">Join Google Meet</a>
				{/if}
			</div>
			<Badge tone={s.tone}>{s.status}</Badge>
			<div class="row-actions">
				<Button
					variant="secondary"
					size="sm"
					onclick={() => requestReschedule(s.id, s.rescheduleChargesRegularRate)}>Reschedule</Button
				>
				<form
					method="POST"
					action="?/cancelSession"
					use:enhance={() => {
						return async ({ update }) => update();
					}}
				>
					<input type="hidden" name="appointmentId" value={s.id} />
					<Button type="submit" variant="secondary" size="sm">Cancel</Button>
				</form>
			</div>
		</div>
	</Card>
{/each}

{#if pendingRescheduleId}
	<RescheduleChargeDialog
		onconfirm={confirmPendingReschedule}
		oncancel={() => (pendingRescheduleId = null)}
	/>
{/if}

<style>
	.row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px 14px;
	}

	.row-info {
		flex: 1;
		min-width: 140px;
	}

	.row-title {
		font-weight: 700;
		color: var(--text-primary);
	}

	.row-sub {
		font-size: 13px;
		color: var(--text-muted);
	}

	.row-meet {
		display: inline-block;
		font-size: 13px;
		margin-top: 4px;
		color: var(--sage-600, var(--text-primary));
	}

	.row-actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}
</style>
