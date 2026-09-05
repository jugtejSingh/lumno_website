<script lang="ts">
	import Nav from '$lib/components/utils/Nav.svelte';
	import Footer from '$lib/components/utils/Footer.svelte';
	import Card from '$lib/components/utils/Card.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const PLAN_NAME_TO_TIER: Record<string, 1 | 2> = { basic: 1, pro: 2 };

	// Landed here from the post-login redirect (see root +layout.server.ts) with a
	// plan the visitor picked while logged out — open checkout straight away.
	onMount(() => {
		const buy = page.url.searchParams.get('buy');
		if (buy && buy in PLAN_NAME_TO_TIER) {
			replaceState('/pricing', {});
			choosePlan(PLAN_NAME_TO_TIER[buy]);
		}
	});

	// Logged-out visitor picked a paid plan: remember it, send them to register,
	// the layout redirects back here once they're in.
	function startPlan(name: string) {
		document.cookie = `pending_plan=${name}; path=/; max-age=3600; samesite=lax`;
		goto('/login?tab=register');
	}

	function blockedDowngrade() {
		toast.error("Cancel your current plan in Settings first — you can't downgrade here.");
	}

	// ponytail: placeholder display copy — the amount actually charged comes
	// from the Razorpay plan configured behind RAZORPAY_PLAN_ID_1/2 (razorpay.ts),
	// not from anything here. Update both places together (Razorpay dashboard too).
	const PLANS: {
		tier: 0 | 1 | 2;
		name: string;
		price: string;
		period: string;
		blurb: string;
		features: string[];
	}[] = [
		{
			tier: 0,
			name: 'Free',
			price: 'Free',
			period: '',
			blurb: 'Try it out with a small caseload, no card required.',
			features: [
				'Up to 5 clients',
				'40 appointments / month',
				'Calendar with Google Meet links',
				'Automated email reminders for sessions & payments',
				'Notes sent to clients automatically',
				'Payment collection & invoicing'
			]
		},
		{
			tier: 1,
			name: 'Basic',
			price: '₹999',
			period: '/month',
			blurb: 'For a growing solo practice.',
			features: [
				'Up to 30 clients',
				'Unlimited appointments',
				'Calendar with Google Meet links',
				'Automated email reminders for sessions & payments',
				'Notes sent to clients automatically',
				'Payment collection & invoicing',
				'AI note clean-up',
				'Referral program — invite other therapists'
			]
		},
		{
			tier: 2,
			name: 'Pro',
			price: '₹1899',
			period: '/month',
			blurb: 'For a full practice, with no caseload ceiling.',
			features: [
				'Unlimited clients',
				'Unlimited appointments',
				'Calendar with Google Meet links',
				'Automated email reminders for sessions & payments',
				'Notes sent to clients automatically',
				'Payment collection & invoicing',
				'AI note clean-up',
				'Referral program — invite other therapists'
			]
		}
	];

	const ERROR_MESSAGES: Record<string, string> = {
		same_plan: "You're already on this plan.",
		active_subscription_exists: 'Your subscription is mid-change — try again in a moment.',
		subscription_in_progress: 'A checkout is already in progress — try again in a moment.',
		subscription_creation_failed: 'Could not start checkout. Try again.',
		invalid_plan: 'That plan is not available.'
	};

	let loadingTier = $state<number | null>(null);

	function loadCheckoutScript(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (window.Razorpay) {
				resolve();
				return;
			}
			const script = document.createElement('script');
			script.src = 'https://checkout.razorpay.com/v1/checkout.js';
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('failed to load checkout script'));
			document.head.appendChild(script);
		});
	}

	async function choosePlan(tier: number) {
		loadingTier = tier;
		try {
			const res = await fetch('/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ plan: tier })
			});
			if (!res.ok) {
				const body: { message?: string } = await res.json().catch(() => ({}));
				toast.error(ERROR_MESSAGES[body.message ?? ''] ?? 'Something went wrong. Try again.');
				loadingTier = null;
				return;
			}
			const { subscriptionId, key } = await res.json();
			await loadCheckoutScript();
			const checkout = new window.Razorpay({
				key,
				subscription_id: subscriptionId,
				name: 'Lumno',
				// The real entitlement flip happens async via the webhook once the
				// first charge confirms — this is just UX feedback that checkout
				// finished, not proof the plan changed yet.
				handler: () => goto('/settings?checkout=processing'),
				modal: { ondismiss: () => (loadingTier = null) }
			});
			checkout.open();
		} catch {
			toast.error('Something went wrong. Try again.');
			loadingTier = null;
		}
	}
</script>

<svelte:head>
	<title>Pricing — Lumno</title>
	<meta name="description" content="Simple, transparent pricing for therapists running their practice on Lumno." />
</svelte:head>

<div class="page">
	<Nav />

	<div class="pricing">
		<div class="header">
			<div class="title">Pricing</div>
			<div class="subtitle">Simple plans that grow with your practice.</div>
		</div>

		<div class="plans">
			{#each PLANS as plan (plan.tier)}
				<div class="plan-card" class:featured={plan.tier === 2}>
					{#if plan.tier === 2}
						<div class="popular-badge">Most popular</div>
					{/if}
					<Card>
						<div class="plan">
							<div class="plan-name">{plan.name}</div>
							<div class="plan-price">{plan.price}<span class="plan-period">{plan.period}</span></div>
							<div class="plan-blurb">{plan.blurb}</div>
							<ul class="plan-features">
								{#each plan.features as feature (feature)}
									<li><span class="feature-mark">✓</span>{feature}</li>
								{/each}
							</ul>
							{#if data.currentTier === plan.tier}
								<div class="current-badge">Current plan</div>
							{:else if plan.tier === 0}
								{#if data.currentTier === null}
									<Button href="/login?tab=register" variant="secondary">Get started</Button>
								{:else}
									<Button variant="secondary" onclick={blockedDowngrade}>Choose Free</Button>
								{/if}
							{:else if data.currentTier === null}
								<Button variant="primary" onclick={() => startPlan(plan.name.toLowerCase())}>
									Get started
								</Button>
							{:else}
								<Button
									variant="primary"
									onclick={() => choosePlan(plan.tier)}
								>
									{loadingTier === plan.tier ? 'Loading…' : 'Choose plan'}
								</Button>
							{/if}
						</div>
					</Card>
				</div>
			{/each}
		</div>
	</div>

	<Footer />
</div>

<style>
	.page {
		min-height: 100vh;
		background: var(--surface-app);
		color: var(--text-primary);
	}

	.pricing {
		max-width: 1180px;
		margin: 0 auto;
		padding: 80px 24px;
		display: flex;
		flex-direction: column;
		gap: 44px;
	}

	.header {
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.title {
		font-family: var(--font-display);
		font-size: 52px;
	}

	.subtitle {
		font-size: 18px;
		color: var(--text-secondary);
	}

	.plans {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 28px;
		align-items: start;
	}

	.plan-card {
		position: relative;
	}

	.plan-card :global(.card) {
		padding: 40px 36px;
		height: 100%;
	}

	.plan-card.featured :global(.card) {
		border: 2px solid var(--accent-primary);
		box-shadow: var(--shadow-lg);
	}

	.popular-badge {
		position: absolute;
		top: -14px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--accent-primary);
		color: var(--text-on-accent);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		padding: 5px 14px;
		border-radius: var(--radius-pill);
		z-index: 1;
	}

	.plan {
		display: flex;
		flex-direction: column;
		gap: 20px;
		align-items: flex-start;
	}

	.plan-name {
		font-weight: 700;
		font-size: 20px;
	}

	.plan-price {
		font-family: var(--font-display);
		font-size: 48px;
	}

	.plan-period {
		font-size: 17px;
		color: var(--text-secondary);
		font-family: var(--font-body);
	}

	.plan-blurb {
		font-size: 15px;
		color: var(--text-secondary);
		margin-top: -12px;
	}

	.plan-features {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		font-size: 16px;
		color: var(--text-secondary);
		width: 100%;
	}

	.plan-features li {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}

	.feature-mark {
		flex-shrink: 0;
		font-weight: 700;
		color: var(--accent-calm);
	}

	.current-badge {
		font-size: 14px;
		font-weight: 700;
		color: var(--text-muted);
	}
</style>
