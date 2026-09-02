<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import Textarea from '$lib/components/utils/Textarea.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';
	import Switch from '$lib/components/utils/Switch.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const TIER_NAMES: Record<number, string> = { 0: 'Free', 1: 'Basic', 2: 'Pro' };
	let cancelling = $state(false);

	async function cancelPlan() {
		cancelling = true;
		try {
			await fetch('/cancel', { method: 'POST' });
			await invalidateAll();
		} finally {
			cancelling = false;
		}
	}

	const colors = ['plum', 'coral', 'sage', 'citrus'] as const;

	let name = $state(data.profile.name);
	let bio = $state(data.profile.bio);
	let rate = $state(data.profile.rate);
	let visible = $state(data.profile.visible);
	let email = $state(data.profile.email);
	let password = $state('');
	let specialties = $state(data.profile.specialties);
	let newTag = $state('');
	let saveLabel = $state('Save changes');

	const specialtyTags = $derived(
		specialties.map((label, i) => ({ label, color: colors[i % colors.length] }))
	);

	function removeTag(label: string) {
		specialties = specialties.filter((t) => t !== label);
	}

	function addTagOnEnter(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		const v = newTag.trim();
		if (!v) return;
		specialties = [...specialties, v];
		newTag = '';
	}

	function save() {
		saveLabel = 'Saved';
		setTimeout(() => (saveLabel = 'Save changes'), 1400);
	}

	function updatePassword() {
		password = '';
	}
</script>

<div class="settings">
	<div class="header">
		<div class="title">Settings</div>
		<Button variant="primary" onclick={save}>{saveLabel}</Button>
	</div>

	<Card>
		<div class="section">
			<div class="section-title">Referral profile</div>
			<div class="name-row">
				<Avatar {name} size={44} />
				<div class="name-field"><Input label="Name" bind:value={name} /></div>
			</div>
			<div>
				<div class="field-label">Specialties</div>
				<div class="tag-row">
					{#each specialtyTags as s (s.label)}
						<Tag color={s.color} onremove={() => removeTag(s.label)}>{s.label}</Tag>
					{/each}
				</div>
				<Input
					placeholder="Add a specialty and press enter"
					bind:value={newTag}
					onkeydown={addTagOnEnter}
				/>
			</div>
			<Textarea label="Bio" placeholder="A few sentences other therapists will see" bind:value={bio} rows={3} />
			<div class="rate-field"><Input label="Session rate" bind:value={rate} /></div>
		</div>
	</Card>

	<Card>
		<div class="section">
			<div class="section-title">Referral visibility</div>
			<Switch label="List me in Referrals" bind:checked={visible} />
			<div class="helper">
				{#if visible}
					You're visible to other therapists on the Referrals page. Turn this off any time to
					disappear from that list.
				{:else}
					You're hidden from the Referrals page. Turn this on when you're open to taking referrals.
				{/if}
			</div>
		</div>
	</Card>

	<Card>
		<div class="section">
			<div class="section-title">Plan</div>
			<div class="plan-row">
				<div class="plan-label">
					{TIER_NAMES[data.billing.plan]}
					{#if data.billing.status === 'past_due'}
						<span class="plan-warning">— payment failed</span>
					{:else if data.billing.cancelScheduled}
						<span class="plan-warning">— cancels at period end</span>
					{/if}
				</div>
				<div class="plan-actions">
					{#if data.billing.plan === 0}
						<Button href="/pricing" variant="primary" size="sm">Upgrade</Button>
					{:else}
						<Button href="/pricing" variant="secondary" size="sm">Change plan</Button>
						{#if data.billing.status === 'active' && !data.billing.cancelScheduled}
							<Button variant="secondary" size="sm" onclick={cancelPlan}>
								{cancelling ? 'Cancelling…' : 'Cancel plan'}
							</Button>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	</Card>

	<Card>
		<div class="section">
			<div class="section-title">Account</div>
			<Input label="Email" type="email" bind:value={email} />
			<Input label="New password" type="password" placeholder="••••••••" bind:value={password} />
			<div><Button variant="secondary" onclick={updatePassword}>Update password</Button></div>
		</div>
	</Card>
</div>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 24px;
		max-width: 640px;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
	}

	.title {
		font-family: var(--font-display);
		font-size: 32px;
		color: var(--text-primary);
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.section-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.name-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.name-field {
		flex: 1;
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 6px;
	}

	.tag-row {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}

	.rate-field {
		width: 220px;
	}

	.helper {
		font-size: 13px;
		color: var(--text-muted);
		line-height: var(--lh-relaxed);
	}

	.helper.error {
		color: var(--accent-danger, #c0392b);
	}

	.plan-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.plan-label {
		font-size: 15px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.plan-warning {
		font-weight: 600;
		color: var(--accent-danger, #c0392b);
	}

	.plan-actions {
		display: flex;
		gap: 8px;
	}
</style>
