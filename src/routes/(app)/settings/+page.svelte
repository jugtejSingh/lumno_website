<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import Textarea from '$lib/components/utils/Textarea.svelte';
	import Select from '$lib/components/utils/Select.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';
	import Switch from '$lib/components/utils/Switch.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import TimeInput from '$lib/components/utils/TimeInput.svelte';
	import { untrack } from 'svelte';
	import { enhance } from '$lib/enhance';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const TIER_NAMES: Record<number, string> = { 0: 'Free', 1: 'Basic', 2: 'Pro' };
	const PLAN_SUMMARY: Record<number, { caseload: string; perks: string[] }> = {
		0: {
			caseload: 'Up To 5 Clients · 40 Appointments / Month',
			perks: [
				'Calendar With Google Meet Links',
				'Automated Session & Payment Emails',
				'Notes Sent To Clients Automatically',
				'Payment Collection & Invoicing'
			]
		},
		1: {
			caseload: 'Up To 30 Clients · Unlimited Appointments',
			perks: [
				'Everything In Free',
				'AI Note Clean-Up',
				'Referral Program — Invite Other Therapists'
			]
		},
		2: {
			caseload: 'Unlimited Clients · Unlimited Appointments',
			perks: [
				'Everything In Basic',
				'AI Note Clean-Up',
				'Referral Program — Invite Other Therapists',
				'No Caseload Ceiling'
			]
		}
	};
	let cancelling = $state(false);

	// Slugs thrown by /cancel — anything else (network drop, 500 without a body)
	// gets the generic line.
	const CANCEL_ERROR_MESSAGES: Record<string, string> = {
		no_active_subscription: "There's no active plan to cancel.",
		already_cancelled: 'This plan is already cancelled.',
		cancellation_failed: "We couldn't reach the payment provider. Please try again in a minute."
	};

	async function cancelPlan() {
		cancelling = true;
		try {
			const res = await fetch('/cancel', { method: 'POST' });
			if (!res.ok) {
				let slug = '';
				try {
					const body = await res.json();
					if (body && typeof body.message === 'string') {
						slug = body.message;
					}
				} catch {
					// no JSON body — fall through to the generic message
				}
				toast.error(CANCEL_ERROR_MESSAGES[slug] ?? 'Could not cancel the plan. Please try again.');
				return;
			}
			toast.success('Your plan will end at the close of this billing period.');
			await invalidateAll();
		} catch {
			toast.error('Could not cancel the plan. Check your connection and try again.');
		} finally {
			cancelling = false;
		}
	}

	const colors = ['plum', 'coral', 'sage', 'citrus'] as const;

	const FORMAT_OPTIONS = [
		{ value: '', label: 'Not Set' },
		{ value: 'remote', label: 'Remote' },
		{ value: 'in_person', label: 'In-Person' },
		{ value: 'hybrid', label: 'Remote & In-Person' }
	];
	const formatLabels = FORMAT_OPTIONS.map((o) => o.label);

	const weekdayLabels = [
		'Sunday',
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday'
	];
	const scheduleKindOptions = [
		{ value: 'online', label: 'Online' },
		{ value: 'in_person', label: 'In Person' },
		{ value: 'hybrid', label: 'Hybrid (client chooses)' },
		{ value: 'off', label: 'Holiday' }
	];

	// form drafts below are deliberately seeded from the initial load data only
	const initial = untrack(() => data);

	// ---- referral profile ----
	let name = $state(initial.profile.name);
	let bio = $state(initial.profile.bio);
	let location = $state(initial.profile.location ?? '');
	let years = $state(initial.profile.yearsExperience?.toString() ?? '');
	let rate = $state(initial.profile.sessionRate?.toString() ?? '');
	let formatLabel = $state(
		FORMAT_OPTIONS.find((o) => o.value === (initial.profile.sessionFormat ?? ''))?.label ??
			'Not Set'
	);
	let visible = $state(initial.profile.referralVisible);
	let showYears = $state(initial.profile.referralShowYears);
	let showRate = $state(initial.profile.referralShowRate);
	let specialties = $state(initial.profile.tags);
	let newTag = $state('');

	// ---- schedule ----
	let bufferMinutes = $state(initial.schedule.bufferMinutes);
	let workStart = $state(initial.schedule.earliestBookingTime.slice(0, 5));
	let workEnd = $state(initial.schedule.latestBookingTime.slice(0, 5));
	let weeklySchedule = $state([...initial.schedule.weeklySchedule]);

	// ---- notifications ----
	let sendMeetLinks = $state(initial.notifications.sendMeetLinks);
	let sendBookingEmails = $state(initial.notifications.sendBookingEmails);
	let sendSessionReminderEmails = $state(initial.notifications.sendSessionReminderEmails);
	let sendPaymentReminderEmails = $state(initial.notifications.sendPaymentReminderEmails);

	// ---- payments ----
	let freeChangeWindowHours = $state(initial.payments.freeChangeWindowHours);
	let partialChangeWindowHours = $state(
		initial.payments.partialChangeWindowHours === null
			? ''
			: String(initial.payments.partialChangeWindowHours)
	);
	let payBankDetails = $state(initial.manualPay.bankDetails);
	let removePayQr = $state(false);
	let paymentModeAutomatic = $state(initial.payments.paymentMode === 'automatic');
	// the portal-pay switch is always shown, but locked until Razorpay is connected;
	// clicking it while locked opens the connect prompt below it
	let showConnectPrompt = $state(false);
	// disconnecting stops portal payments for every client, so it takes two clicks
	let confirmDisconnect = $state(false);

	// ---- Razorpay connection ----
	const rzp = $derived(data.razorpay);
	const RZP_NOTICES: Record<string, string> = {
		connected: 'Razorpay connected — clients can now pay their invoices in the portal.',
		declined: 'Razorpay connection was cancelled.',
		state_error: "Couldn't complete the Razorpay connection. Please try again.",
		account_changed:
			'You connected a different Razorpay account — past invoices stay linked to the old one.',
		not_inr: 'Portal payments are INR-only. Set your currency to INR before connecting Razorpay.',
		disconnected: 'Razorpay disconnected. Clients can no longer pay invoices in the portal.'
	};
	const rzpNotice = $derived(rzp.notice ? RZP_NOTICES[rzp.notice] : undefined);

	let saveLabel = $state('Save Changes');

	// Everything the save action writes, as one comparable string. The QR file
	// input is uncontrolled, so qrFileName is what makes a picked file count.
	// Save stays disabled until this drifts from the last-saved snapshot.
	let qrFileName = $state('');
	function currentValues(): string {
		return JSON.stringify([
			name,
			bio,
			location,
			years,
			rate,
			formatLabel,
			visible,
			showYears,
			showRate,
			specialties,
			bufferMinutes,
			workStart,
			workEnd,
			weeklySchedule,
			sendMeetLinks,
			sendBookingEmails,
			sendSessionReminderEmails,
			sendPaymentReminderEmails,
			freeChangeWindowHours,
			partialChangeWindowHours,
			payBankDetails,
			removePayQr,
			paymentModeAutomatic,
			qrFileName
		]);
	}
	let savedValues = $state(currentValues());
	const dirty = $derived(currentValues() !== savedValues);

	// account section stays non-functional (out of scope). Email is display-only —
	// changing it isn't supported here.
	let password = $state('');

	const specialtyTags = $derived(
		specialties.map((label, i) => ({ label, color: colors[i % colors.length] }))
	);
	const formatValue = $derived(FORMAT_OPTIONS.find((o) => o.label === formatLabel)?.value ?? '');

	function removeTag(label: string) {
		specialties = specialties.filter((t) => t !== label);
	}

	function addTagOnEnter(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const v = newTag.trim();
		if (!v || specialties.includes(v)) return;
		specialties = [...specialties, v];
		newTag = '';
	}

	function updatePassword() {
		password = '';
	}
</script>

<form
	class="settings"
	method="POST"
	action="?/save"
	enctype="multipart/form-data"
	use:enhance={({ action }) => {
		// the Disconnect button posts to ?/disconnectRazorpay via formaction — same
		// form, different action, so "Saved" must not flash for it
		const isSave = action.search === '?/save';
		return async ({ update }) => {
			await update({ reset: false });
			if (isSave) {
				// update({ reset: false }) leaves the inputs (file input included)
				// exactly as posted, so what's on screen is now what's saved
				savedValues = currentValues();
				saveLabel = 'Saved';
				setTimeout(() => (saveLabel = 'Save Changes'), 1400);
			}
		};
	}}
>
	<div class="header">
		<div class="title">Settings</div>
	</div>

	{#if form?.message}
		<div class="form-error">{form.message}</div>
	{/if}
	{#if data.calendarError}
		<div class="form-error">{data.calendarError}</div>
	{/if}

	<input type="hidden" name="tags" value={specialties.join(',')} />
	<input type="hidden" name="sessionFormat" value={formatValue} />
	<input type="hidden" name="referralVisible" value={visible ? 'on' : ''} />
	<input type="hidden" name="referralShowYears" value={showYears ? 'on' : ''} />
	<input type="hidden" name="referralShowRate" value={showRate ? 'on' : ''} />
	<input type="hidden" name="sendMeetLinks" value={sendMeetLinks ? 'on' : ''} />
	<input type="hidden" name="removePayQr" value={removePayQr ? 'on' : ''} />
	<input type="hidden" name="sendBookingEmails" value={sendBookingEmails ? 'on' : ''} />
	<input type="hidden" name="paymentModeAutomatic" value={paymentModeAutomatic ? 'on' : ''} />
	<input
		type="hidden"
		name="sendSessionReminderEmails"
		value={sendSessionReminderEmails ? 'on' : ''}
	/>
	<input
		type="hidden"
		name="sendPaymentReminderEmails"
		value={sendPaymentReminderEmails ? 'on' : ''}
	/>

	<Card>
		<div class="section">
			<div class="section-title">Referral Profile</div>
			<div class="name-row">
				<Avatar {name} size={44} />
				<div class="name-field"><Input label="Name" name="name" bind:value={name} /></div>
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
			<Textarea
				label="Bio"
				name="bio"
				placeholder="A few sentences other therapists will see"
				bind:value={bio}
				rows={3}
			/>
			<div class="grid-2">
				<Select label="Session Format" options={formatLabels} bind:value={formatLabel} />
				<Input label="Location" name="location" bind:value={location} />
			</div>
			<div class="grid-2">
				<Input label="Years of Experience" name="yearsExperience" bind:value={years} />
				<Input label="Session Rate" name="sessionRate" bind:value={rate} />
			</div>
		</div>
	</Card>

	<Card>
		<div class="section">
			<div class="section-title">Referral Visibility</div>
			<Switch label="List Me in Referrals" bind:checked={visible} />
			<div class="helper">
				{#if visible}
					You're visible to other therapists on the Referrals page. Turn this off any time to
					disappear from that list.
				{:else}
					You're hidden from the Referrals page. Turn this on when you're open to taking referrals.
				{/if}
			</div>
			<Switch label="Show My Years of Experience" bind:checked={showYears} />
			<Switch label="Show My Session Rate" bind:checked={showRate} />
		</div>
	</Card>

	<Card>
		<div class="section">
			<div class="section-title">Schedule</div>
			<label class="field">
				<span class="field-label">Buffer Between Sessions (Minutes)</span>
				<input
					class="field-input"
					type="number"
					name="bufferMinutes"
					min="0"
					step="5"
					bind:value={bufferMinutes}
				/>
			</label>
			<div class="grid-2">
				<TimeInput label="Working Hours From" name="earliestBookingTime" bind:value={workStart} />
				<TimeInput label="Working Hours To" name="latestBookingTime" bind:value={workEnd} />
			</div>
			<div class="field">
				<span class="field-label">Weekly Pattern</span>
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
		</div>
	</Card>

	<Card>
		<div class="section">
			<div class="section-title">Notifications</div>
			{#if data.googleConnected}
				<Switch label="Add a Google Meet link to online sessions" bind:checked={sendMeetLinks} />
			{:else}
				<div class="helper">
					Connect Google Calendar (below) to add a Meet link to online sessions automatically.
				</div>
			{/if}
			<Switch
				label="Email clients when a session is booked, cancelled, or rescheduled"
				bind:checked={sendBookingEmails}
			/>
			<Switch
				label="Email clients a reminder 24 hours and 1 hour before their session"
				bind:checked={sendSessionReminderEmails}
			/>
			<Switch
				label="Email clients with an outstanding balance a reminder every week"
				bind:checked={sendPaymentReminderEmails}
			/>
		</div>
	</Card>

	<Card>
		<div class="section">
			<div class="section-title">Payments</div>

			<div class="helper">
				Each logged session becomes an invoice for the client. Mark invoices paid by hand from the
				Payments page for cash, bank transfers, or anything settled outside the portal. Connect
				Razorpay below to let clients pay by card or UPI in the portal.
			</div>
			<div class="helper">
				The two windows below set your late-change policy: a client who cancels or reschedules with
				more notice than the free window owes nothing; inside the 50% window they owe half the
				session rate; with less notice than that they owe the full rate.
			</div>

			{#if rzpNotice}
				<div class="rzp-notice" class:rzp-notice-bad={rzp.notice === 'state_error'}>
					{rzpNotice}
				</div>
			{/if}

			<!-- connection status, once they've connected at least once -->
			{#if rzp.health !== 'not_connected'}
				<div
					class="rzp-banner"
					class:rzp-banner-amber={rzp.health === 'expiring'}
					class:rzp-banner-red={rzp.health === 'action_needed'}
					data-sveltekit-reload
				>
					{#if rzp.health === 'connected'}
						<span>Razorpay connected · renews automatically</span>
					{:else if rzp.health === 'expiring'}
						<span>Reconnect Razorpay to keep portal payments working</span>
						<Button href="/settings/payments/connect" variant="secondary" size="sm">Reconnect</Button>
					{:else}
						<span>Portal payments are paused — reconnect Razorpay to resume</span>
						<Button href="/settings/payments/connect" variant="secondary" size="sm">Reconnect</Button>
					{/if}
					{#if !confirmDisconnect}
						<Button variant="secondary" size="sm" onclick={() => (confirmDisconnect = true)}>
							Disconnect
						</Button>
					{/if}
				</div>
				{#if confirmDisconnect}
					<div class="rzp-connect">
						<span>
							Disconnect Razorpay? Clients won't be able to pay invoices in the portal until you
							connect again. Payments already taken are unaffected.
						</span>
						<Button type="submit" formaction="?/disconnectRazorpay" variant="secondary" size="sm">
							Yes, disconnect
						</Button>
						<Button size="sm" onclick={() => (confirmDisconnect = false)}>Keep connected</Button>
					</div>
				{/if}
			{/if}

			<Switch
				label="Let clients pay invoices in the portal with Razorpay"
				bind:checked={paymentModeAutomatic}
				locked={rzp.health !== 'connected' && rzp.health !== 'expiring'}
				onlockedclick={() => (showConnectPrompt = true)}
			/>
			{#if showConnectPrompt && rzp.health !== 'connected' && rzp.health !== 'expiring'}
				<div class="rzp-connect" data-sveltekit-reload>
					{#if !rzp.currencySupported}
						<span>Online payments are only available for INR practices.</span>
					{:else if rzp.health === 'action_needed'}
						<span>Your Razorpay connection stopped working. Reconnect it to turn this on.</span>
						<Button href="/settings/payments/connect" size="sm">Reconnect Razorpay</Button>
					{:else}
						<span>To let clients pay online, connect your Razorpay account first.</span>
						<Button href="/settings/payments/connect" size="sm">Connect Razorpay</Button>
					{/if}
				</div>
			{/if}
			<div class="helper">Your QR code, bank details and "Mark paid" keep working either way.</div>

			<label class="field">
				<span class="field-label">Free Cancellation / Reschedule Window</span>
				<select class="field-input" name="freeChangeWindowHours" bind:value={freeChangeWindowHours}>
					{#each data.hourOptions as o (o.hours)}
						<option value={o.hours}>{o.label}</option>
					{/each}
				</select>
			</label>
			<label class="field">
				<span class="field-label">50% Fee Window</span>
				<select
					class="field-input"
					name="partialChangeWindowHours"
					bind:value={partialChangeWindowHours}
				>
					<option value="">No partial tier — straight to 100%</option>
					{#each data.hourOptions as o (o.hours)}
						<option value={o.hours}>{o.label}</option>
					{/each}
				</select>
			</label>

			<div class="section-title">How Clients Pay You</div>
			<div class="helper">
				Shown to clients in their portal next to any unpaid invoice. Upload a UPI / payment QR code
				image and add the account details they should transfer to.
			</div>
			{#if data.manualPay.qrUrl}
				<div class="qr-current">
					<img class="qr-preview" src={data.manualPay.qrUrl} alt="Your payment QR code" />
					<Switch label="Remove this QR code on save" bind:checked={removePayQr} />
				</div>
			{/if}
			<label class="field">
				<span class="field-label">
					{data.manualPay.qrUrl ? 'Replace QR Code Image' : 'QR Code Image'}
				</span>
				<input
					class="field-input"
					type="file"
					name="payQrImage"
					accept="image/png,image/jpeg,image/webp"
					onchange={(e) => (qrFileName = e.currentTarget.files?.[0]?.name ?? '')}
				/>
			</label>
			<Textarea
				label="Bank / UPI Details"
				name="payBankDetails"
				rows={4}
				placeholder="Account name&#10;Account number&#10;IFSC&#10;UPI id"
				bind:value={payBankDetails}
			/>
		</div>
	</Card>

	<Card>
		<div class="section">
			<div class="section-title">Plan</div>
			<div class="plan-block">
				<div class="plan-summary">
					<div class="plan-caseload">{PLAN_SUMMARY[data.billing.plan].caseload}</div>
					<ul class="plan-perks">
						{#each PLAN_SUMMARY[data.billing.plan].perks as perk (perk)}
							<li>{perk}</li>
						{/each}
					</ul>
				</div>
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
							<Button href="/pricing" variant="secondary" size="sm">Change Plan</Button>
							{#if data.billing.status === 'active' && !data.billing.cancelScheduled}
								<Button variant="secondary" size="sm" onclick={cancelPlan}>
									{cancelling ? 'Cancelling…' : 'Cancel Plan'}
								</Button>
							{/if}
						{/if}
					</div>
				</div>
			</div>
		</div>
	</Card>

	<Card>
		<div class="section">
			<div class="section-title">Account</div>
			<div class="field">
				<span class="field-label">Email</span>
				<div class="field-static">{data.user.email}</div>
			</div>
			<Input label="New Password" type="password" placeholder="••••••••" bind:value={password} />
			<div><Button variant="secondary" onclick={updatePassword}>Update Password</Button></div>
		</div>
	</Card>

	<!-- nothing edited yet = nothing to save, so the bar isn't there at all -->
	{#if dirty || saveLabel === 'Saved'}
		<div class="save-bar">
			<Button variant="primary" size="lg" type="submit">{saveLabel}</Button>
		</div>
	{/if}
</form>

{#if !data.googleConnected}
	<form class="connect-form" method="POST" action="?/connectGoogleCalendar">
		<Button type="submit" variant="secondary">Connect Google Calendar</Button>
	</form>
{/if}

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 24px;
		max-width: 640px;
		margin-inline: auto;
	}

	/* sticks to the bottom of the scrolling .app-content while the form is on screen */
	.save-bar {
		position: sticky;
		bottom: 16px;
		/* .settings is a flex column, so align-self shrinks the wrapper to the button
		   and centres it. No card around it — drop-shadow follows the button shape,
		   which is what lifts it off the content scrolling underneath. */
		align-self: center;
		display: flex;
		filter: drop-shadow(0 6px 20px rgba(0, 0, 0, 0.18));
		max-width: 100%;
		z-index: 10;
	}

	/* bigger than any Button size preset, and clamp()ed so it scales with the
	   viewport instead of overflowing a 320px phone */
	.save-bar :global(.btn) {
		font-size: clamp(15px, 4vw, 19px);
		padding: clamp(13px, 3.6vw, 20px) clamp(30px, 10vw, 64px);
	}

	.connect-form {
		max-width: 640px;
		margin: 16px auto 0;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		flex-wrap: wrap;
		gap: 10px;
	}

	.title {
		font-family: var(--font-display);
		font-size: clamp(24px, 5vw, 32px);
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

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 6px;
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

	.field-static {
		font-size: 14px;
		color: var(--text-secondary);
		padding: 10px 12px;
		background: var(--surface-canvas);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
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
		width: 160px;
	}

	.tag-row {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}

	.grid-2 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
		gap: 12px;
	}

	.helper {
		font-size: 13px;
		color: var(--text-muted);
		line-height: var(--lh-relaxed);
	}

	.qr-current {
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: flex-start;
	}

	.qr-preview {
		width: 160px;
		height: 160px;
		object-fit: contain;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
	}

	.form-error {
		color: var(--danger, #b3261e);
		font-size: 13px;
	}

	.rzp-notice {
		font-size: 13px;
		color: var(--text-secondary);
		background: var(--surface-canvas);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 8px 12px;
	}

	.rzp-notice-bad {
		color: var(--danger, #b3261e);
	}

	.rzp-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		font-size: 13px;
		color: var(--text-secondary);
		background: var(--surface-canvas);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
	}

	.rzp-banner-amber {
		color: #8a5a00;
		background: #fff6e5;
		border-color: #f0d9a8;
	}

	.rzp-banner-red {
		color: #b3261e;
		background: #fdecea;
		border-color: #f3c1bc;
	}

	.rzp-connect {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		font-size: 13px;
		color: var(--text-primary);
		background: var(--surface-canvas);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 12px;
	}

	.plan-block {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.plan-summary {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.plan-caseload {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.plan-perks {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 3px;
		font-size: 13px;
		color: var(--text-muted);
		line-height: var(--lh-relaxed);
	}

	.plan-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
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
