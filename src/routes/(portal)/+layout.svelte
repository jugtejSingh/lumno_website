<script lang="ts">
	import Logo from '$lib/components/utils/Logo.svelte';
	import SidebarNavItem from '$lib/components/utils/SidebarNavItem.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import MobileNav from '$lib/components/utils/MobileNav.svelte';
	import FeedbackDialog from '$lib/components/utils/FeedbackDialog.svelte';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import { enhance } from '$lib/enhance';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	let feedbackOpen = $state(false);

	const links = [
		{ href: '#calendar', label: 'Calendar' },
		{ href: '#payments', label: 'Payments' },
		{ href: '#notes', label: 'Notes' },
		{ href: '#details', label: 'Your details' }
	];
</script>

<div class="app-shell">
	<aside class="sidebar">
		<div class="sidebar-logo"><Logo /></div>
		{#each links as link (link.href)}
			<a href={link.href} class="sidebar-link">
				<SidebarNavItem label={link.label} />
			</a>
		{/each}
		<div class="sidebar-spacer"></div>
		<div class="sidebar-actions">
			<button type="button" class="sidebar-link-btn" onclick={() => (feedbackOpen = true)}>
				<SidebarNavItem label="Feedback" tone="quiet" />
			</button>
			<form method="POST" action="/logout" class="sidebar-link" use:enhance>
				<button type="submit" class="sidebar-link-btn">
					<SidebarNavItem label="Log out" tone="danger" />
				</button>
			</form>
		</div>
	</aside>
	<div class="app-main">
		<header class="app-header">
			<div class="app-header-title">Client portal</div>
			<div class="app-header-actions">
				{#if data.clients.length > 1}
					<form method="POST" action="/portal?/switchClient" class="client-switcher" use:enhance>
						<select
							name="clientId"
							value={data.client?.id}
							onchange={(event) => event.currentTarget.form?.requestSubmit()}
						>
							{#each data.clients as option (option.id)}
								<option value={option.id}>{option.therapistName}</option>
							{/each}
						</select>
					</form>
				{/if}
				<Avatar name="Maria Chen" size={30} />
				<MobileNav>
					{#each links as link (link.href)}
						<a href={link.href}>{link.label}</a>
					{/each}
					<button type="button" data-kind="quiet" onclick={() => (feedbackOpen = true)}>
						Feedback
					</button>
					<form method="POST" action="/logout" use:enhance>
						<button type="submit" data-kind="danger">Log out</button>
					</form>
				</MobileNav>
			</div>
		</header>
		<div class="app-content">
			{@render children()}
		</div>
	</div>
</div>

<FeedbackDialog open={feedbackOpen} onclose={() => (feedbackOpen = false)} />

<style>
	.app-shell {
		display: flex;
		height: 100vh;
		background: var(--wallpaper) var(--surface-app);
	}

	.sidebar {
		width: 220px;
		flex-shrink: 0;
		border-right: 2px solid var(--border-subtle);
		background: var(--surface-canvas);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		overflow-y: auto;
	}

	.sidebar-logo {
		margin-bottom: 18px;
		padding-left: 4px;
	}

	/* below 820px the sidebar is hidden and the burger menu (in the header) takes over */
	@media (max-width: 820px) {
		.app-shell {
			flex-direction: column;
			height: auto;
			min-height: 100vh;
		}

		.sidebar {
			display: none;
		}

		.app-content {
			overflow-y: visible;
		}
	}

	.sidebar-link {
		text-decoration: none;
	}

	.sidebar-link-btn {
		width: 100%;
		border: none;
		background: transparent;
		padding: 0;
		margin: 0;
		text-align: left;
		cursor: pointer;
		font-family: var(--font-body);
	}

	.sidebar-spacer {
		flex: 1;
	}

	/* separates the two actions from the destinations above them */
	.sidebar-actions {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 8px;
		padding-top: 8px;
		border-top: 2px dotted var(--beige-400);
	}

	.app-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.app-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		padding: 16px clamp(16px, 4vw, 24px);
		border-bottom: 2px solid var(--border-subtle);
	}

	.app-header-title {
		font-weight: 700;
		font-size: 15px;
		color: var(--text-primary);
	}

	.app-header-actions {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.client-switcher select {
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 2px solid var(--outline);
		box-shadow: var(--shadow-xs);
		border-radius: var(--radius-pill);
		padding: 6px 12px;
		cursor: pointer;
	}

	.app-content {
		flex: 1;
		padding: clamp(16px, 4vw, 24px);
		overflow-y: auto;
	}
</style>
