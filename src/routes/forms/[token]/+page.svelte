<script lang="ts">
	import Logo from '$lib/components/utils/Logo.svelte';
	import Card from '$lib/components/utils/Card.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import QuestionField from '$lib/components/Intake/QuestionField.svelte';
	import { enhance } from '$lib/enhance';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// an error tied to one question shows under it; anything else shows above the button
	const questionError = $derived(form && 'questionId' in form ? form.questionId : null);
</script>

<svelte:head>
	<title>{data.title} — {data.therapistName}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page">
	<div class="header"><Logo /></div>

	<main class="content">
		<h1 class="title">{data.title}</h1>
		<p class="sub">From {data.therapistName}</p>

		{#if form?.submitted}
			<Card>
				<div class="success">
					<div class="success-title">Thank you</div>
					<div>Your answers have been sent to {data.therapistName}.</div>
				</div>
			</Card>
		{:else}
			<Card>
				<form method="POST" action="?/submit" class="form" use:enhance>
					{#if data.intro}
						<p class="intro">{data.intro}</p>
					{/if}
					{#each data.questions as question (question.id)}
						<QuestionField
							{question}
							error={questionError === question.id ? form?.message : undefined}
						/>
					{:else}
						<p class="intro">This form has no questions yet.</p>
					{/each}
					{#if form?.message && !questionError}
						<div class="error" role="alert">{form.message}</div>
					{/if}
					{#if data.questions.length > 0}
						<div>
							<Button type="submit">Send</Button>
						</div>
					{/if}
				</form>
			</Card>
		{/if}
	</main>
</div>

<style>
	.page {
		min-height: 100vh;
		background: var(--surface-canvas);
	}

	.header {
		padding: 20px clamp(16px, 4vw, 32px);
	}

	.content {
		max-width: 720px;
		margin: 0 auto;
		padding: 0 16px 48px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.title {
		font-family: var(--font-display);
		font-size: clamp(22px, 5vw, 30px);
		color: var(--text-primary);
		margin: 0;
	}

	.sub {
		margin: 0;
		color: var(--text-secondary);
		font-size: 15px;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.intro {
		margin: 0;
		color: var(--text-secondary);
		font-size: 15px;
		line-height: var(--lh-relaxed);
		white-space: pre-line;
	}

	.error {
		font-size: 13px;
		color: var(--danger);
	}

	.success {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
		color: var(--text-secondary);
	}

	.success-title {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 600;
		color: var(--text-primary);
	}
</style>
