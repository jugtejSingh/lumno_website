<script lang="ts">
	import { page, navigating } from '$app/state';
	import { enhance } from '$lib/enhance';
	import Logo from '$lib/components/utils/Logo.svelte';
	import SidebarNavItem from '$lib/components/utils/SidebarNavItem.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import MobileNav from '$lib/components/utils/MobileNav.svelte';
	import FeedbackDialog from '$lib/components/utils/FeedbackDialog.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	let feedbackOpen = $state(false);

	const links = [
		{ href: '/dashboard', label: 'Dashboard' },
		{ href: '/calendar', label: 'Calendar' },
		{ href: '/clients', label: 'Clients' },
		{ href: '/payments', label: 'Payments' },
		{ href: '/notes', label: 'Notes' },
		{ href: '/community', label: 'Community' }
	];

	// sits with the other account actions at the bottom, not among the destinations
	const accountLinks = [
		{ href: '/guide', label: 'Guide' },
		{ href: '/settings', label: 'Settings' }
	];
</script>

<div class="app-shell">
	<aside class="sidebar">
		<div class="sidebar-logo"><Logo /></div>
		{#each links as link (link.href)}
			<a
				href={link.href}
				class="sidebar-link"
				class:pending={navigating.to?.url.pathname === link.href}
				aria-busy={navigating.to?.url.pathname === link.href}
			>
				<SidebarNavItem label={link.label} active={page.url.pathname === link.href} />
			</a>
		{/each}
		<div class="sidebar-spacer"></div>
		<div class="sidebar-actions">
			{#each accountLinks as link (link.href)}
				<a
					href={link.href}
					class="sidebar-link"
					class:pending={navigating.to?.url.pathname === link.href}
					aria-busy={navigating.to?.url.pathname === link.href}
				>
					<SidebarNavItem label={link.label} active={page.url.pathname === link.href} />
				</a>
			{/each}
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
			<div class="app-header-title">
				{[...links, ...accountLinks].find((l) => l.href === page.url.pathname)?.label ?? ''}
			</div>
			<div class="app-header-right">
				<Avatar name="Dana Reyes" />
				<MobileNav>
					{#each links as link (link.href)}
						<a href={link.href}>{link.label}</a>
					{/each}
					{#each accountLinks as link (link.href)}
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
		<div class="app-content" class:loading={navigating.to !== null}>
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
		/* .app-shell is 100vh and the page itself doesn't scroll, so on a short window
		   the bottom links (Settings, Feedback, Log out) fall off with no way to reach them */
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

	.sidebar-link.pending {
		opacity: 0.55;
		animation: pulse 0.9s ease-in-out infinite alternate;
	}

	@keyframes pulse {
		to {
			opacity: 1;
		}
	}

	.app-content.loading {
		opacity: 0.5;
		pointer-events: none;
		transition: opacity 0.15s;
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
		padding: 16px clamp(16px, 4vw, 24px);
		border-bottom: 2px solid var(--border-subtle);
		background-color: var(--surface-canvas);
		background-image: repeating-linear-gradient(
			180deg,
			transparent 0 6px,
			rgb(239 196 166 / 0.35) 6px 8px
		);
	}

	.app-header-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 20px;
		color: var(--text-primary);
	}

	.app-header-right {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.app-content {
		flex: 1;
		padding: clamp(16px, 4vw, 24px);
		overflow-y: auto;
	}
</style>