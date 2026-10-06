<script lang="ts">
	import { goto } from '$app/navigation';
	import PortalSessionList from '$lib/components/Portal/PortalSessionList.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="portal">
	<div>
		<div class="title">Welcome back, {data.clientName}</div>
		<div class="subtitle">Your bookings with {data.therapistName}</div>
	</div>

	{#if !data.profileComplete}
		<div class="profile-nudge">
			{data.therapistName} needs a few details about you.
			<a href="/portal/details">Add your details</a>
		</div>
	{/if}

	<div class="section">
		<div class="section-title">Your sessions</div>
		<PortalSessionList
			sessions={data.sessions}
			therapistName={data.therapistName}
			onreschedule={(id) => goto(`/portal/calendar?reschedule=${id}`)}
		/>
		{#if data.sessions.length === 0}
			<div class="hint">
				No upcoming sessions. <a href="/portal/calendar">Book one from the calendar.</a>
			</div>
		{/if}
	</div>
</div>

<style>
	.portal {
		display: flex;
		flex-direction: column;
		gap: clamp(32px, 6vw, 48px);
		max-width: 760px;
	}

	.title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(26px, 6vw, 36px);
		color: var(--text-primary);
	}

	.subtitle {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(16px, 4vw, 18px);
		color: var(--text-link);
		margin-top: 2px;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 12px;
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

	.profile-nudge {
		font-size: 14px;
		color: var(--text-primary);
		background: var(--coral-100);
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 12px 14px;
	}
</style>
