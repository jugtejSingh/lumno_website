<script lang="ts">
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import Card from '$lib/components/utils/Card.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';
	import type { CalendarSession } from '$lib/types/calendar';

	let {
		open,
		sessions,
		onclose
	}: {
		open: boolean;
		sessions: CalendarSession[];
		onclose: () => void;
	} = $props();

	const title = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
</script>

<Dialog {open} {title} {onclose}>
	<div class="today-list">
		{#each sessions as s (s.time + s.name)}
			<Card>
				<div class="today-row">
					<Avatar name={s.name} size={34} />
					<div class="today-info">
						<div class="today-name">{s.name}</div>
						<div class="today-time">{s.time}</div>
						{#if s.notes}
							<div class="today-notes">{s.notes}</div>
						{/if}
						{#if s.meetLink}
							<a class="today-meet" href={s.meetLink} target="_blank" rel="noreferrer">Join Google Meet</a>
						{/if}
					</div>
					<Tag color="sage">{s.modalityLabel}</Tag>
				</div>
			</Card>
		{/each}
		{#if sessions.length === 0}
			<div class="empty">No sessions booked today. Enjoy the quiet.</div>
		{/if}
	</div>
</Dialog>

<style>
	.today-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 320px;
	}

	.today-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.today-info {
		flex: 1;
	}

	.today-name {
		font-weight: 700;
	}

	.today-time {
		font-size: 13px;
		color: var(--text-muted);
	}

	.today-notes {
		font-size: 13px;
		color: var(--text-secondary);
		margin-top: 2px;
		white-space: pre-wrap;
	}

	.today-meet {
		display: inline-block;
		font-size: 13px;
		color: var(--sage-600, var(--text-primary));
		margin-top: 4px;
	}

	.empty {
		color: var(--text-muted);
		font-size: 14px;
		padding: 8px 0;
	}
</style>