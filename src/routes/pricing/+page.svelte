<script lang="ts">
	import Nav from '$lib/components/utils/Nav.svelte';
	import Footer from '$lib/components/utils/Footer.svelte';
	import Card from '$lib/components/utils/Card.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// ponytail: placeholder display copy — the amount actually charged comes
	// from the Razorpay plan configured behind RAZORPAY_PLAN_ID_1/2 (razorpay.ts),
	// not from anything here. Update both places together.
	const PLANS = [
		{
			tier: 0 as const,
			name: 'Free',
			price: '$0',
			period: '',
			features: ['Up to 5 clients', '40 appointments / month']
		},
		{
			tier: 1 as const,
			name: 'Basic',
			price: '$29',
			period: '/month',
			features: ['Up to 50 clients', '400 appointments / month']
		},
		{
			tier: 2 as const,
			name: 'Pro',
			price: '$79',
			period: '/month',
			features: ['Unlimited clients', 'Unlimited appointments']
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
	let errorMessage = $state('');

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
		errorMessage = '';
		loadingTier = tier;
		try {
			const res = await fetch('/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ plan: tier })
			});
			if (!res.ok) {
				const body: { message?: string } = await res.json().catch(() => ({}));
				errorMessage = ERROR_MESSAGES[body.message ?? ''] ?? 'Something went wrong. Try again.';
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
			errorMessage = 'Something went wrong. Try again.';
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

		{#if errorMessage}
			<div class="error-banner">{errorMessage}</div>
		{/if}

		<div class="plans">
			{#each PLANS as plan (plan.tier)}
				<Card>
					<div class="plan">
						<div class="plan-name">{plan.name}</div>
						<div class="plan-price">{plan.price}<span class="plan-period">{plan.period}</span></div>
						<ul class="plan-features">
							{#each plan.features as feature (feature)}
								<li>{feature}</li>
							{/each}
						</ul>
						{#if data.currentTier === plan.tier}
							<div class="current-badge">Current plan</div>
						{:else if plan.tier === 0}
							{#if data.currentTier === null}
								<Button href="/login?tab=register" variant="secondary">Get started</Button>
							{/if}
						{:else if data.currentTier === null}
							<Button href="/login?tab=register" variant="primary">Get started</Button>
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
		max-width: 960px;
		margin: 0 auto;
		padding: 64px 24px;
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	.header {
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.title {
		font-family: var(--font-display);
		font-size: 40px;
	}

	.subtitle {
		font-size: 15px;
		color: var(--text-secondary);
	}

	.error-banner {
		background: var(--surface-card);
		border: 1px solid var(--accent-danger, #c0392b);
		color: var(--accent-danger, #c0392b);
		border-radius: var(--radius-sm);
		padding: 12px 16px;
		font-size: 14px;
		text-align: center;
	}

	.plans {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 20px;
	}

	.plan {
		display: flex;
		flex-direction: column;
		gap: 16px;
		align-items: flex-start;
	}

	.plan-name {
		font-weight: 700;
		font-size: 15px;
	}

	.plan-price {
		font-family: var(--font-display);
		font-size: 32px;
	}

	.plan-period {
		font-size: 14px;
		color: var(--text-secondary);
		font-family: var(--font-body);
	}

	.plan-features {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 14px;
		color: var(--text-secondary);
	}

	.current-badge {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-muted);
	}
</style>
