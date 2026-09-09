<script lang="ts">
	import Logo from '$lib/components/utils/Logo.svelte';
	import SidebarNavItem from '$lib/components/utils/SidebarNavItem.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import { enhance } from '$lib/enhance';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	const links = [
		{ href: '#calendar', label: 'Calendar' },
		{ href: '#payments', label: 'Payments' },
		{ href: '#notes', label: 'Notes' }
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
		<form method="POST" action="/logout" class="sidebar-link" use:enhance>
			<button type="submit" class="sidebar-link-btn"><SidebarNavItem label="Log out" /></button>
		</form>
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
			</div>
		</header>
		<div class="app-content">
			{@render children()}
		</div>
	</div>
</div>

<style>
	.app-shell {
		display: flex;
		height: 100vh;
		background: var(--surface-app);
	}

	.sidebar {
		width: 220px;
		flex-shrink: 0;
		border-right: 1px solid var(--border-subtle);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.sidebar-logo {
		margin-bottom: 18px;
		padding-left: 4px;
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
		padding: 16px 24px;
		border-bottom: 1px solid var(--border-subtle);
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
		background: var(--beige-200);
		border: none;
		border-radius: var(--radius-pill);
		padding: 6px 12px;
		cursor: pointer;
	}

	.app-content {
		flex: 1;
		padding: 24px;
		overflow-y: auto;
	}
</style>
