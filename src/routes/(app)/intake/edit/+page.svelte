<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Card from '$lib/components/utils/Card.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import Textarea from '$lib/components/utils/Textarea.svelte';
	import QuestionEditor from '$lib/components/Intake/QuestionEditor.svelte';
	import { enhance } from '$lib/enhance';
	import { MAX_INTAKE_QUESTIONS, type IntakeQuestion } from '$lib/types/intake';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Seeded once from the server so a reload can't wipe unsaved edits.
	let title = $state(untrack(() => data.title));
	let intro = $state(untrack(() => data.intro));
	let questions = $state<IntakeQuestion[]>(untrack(() => structuredClone(data.questions)));

	const atLimit = $derived(questions.length >= MAX_INTAKE_QUESTIONS);

	function addQuestion() {
		if (atLimit) {
			return;
		}
		// minted here, not on the server, so the id on screen after saving is the stored one
		questions.push({ id: crypto.randomUUID(), label: '', type: 'short_text', required: false });
	}

	function removeQuestion(index: number) {
		questions.splice(index, 1);
	}

	function moveQuestion(index: number, offset: number) {
		const target = index + offset;
		if (target < 0 || target >= questions.length) {
			return;
		}
		const moved = questions[index];
		questions[index] = questions[target];
		questions[target] = moved;
	}
</script>

<svelte:head>
	<title>Edit intake form</title>
</svelte:head>

<div class="page">
	<div><a class="back" href="/intake">← Back to intake</a></div>

	<form
		method="POST"
		action="?/save"
		class="builder"
		use:enhance={() => {
			return async ({ result, update }) => {
				// keep what's on screen; ids are minted client-side so nothing needs reloading
				await update({ reset: false, invalidateAll: false });
				if (result.type === 'success') {
					toast.success('Form saved');
				}
			};
		}}
	>
		<input type="hidden" name="questions" value={JSON.stringify(questions)} />

		<Card>
			<div class="section">
				<Input label="Title" name="title" bind:value={title} />
				<Textarea
					label="Introduction (optional)"
					name="intro"
					rows={3}
					placeholder="Shown above the questions"
					bind:value={intro}
				/>
			</div>
		</Card>

		{#each questions as question, index (question.id)}
			<QuestionEditor
				bind:question={questions[index]}
				position={index + 1}
				isFirst={index === 0}
				isLast={index === questions.length - 1}
				onmove={(offset) => moveQuestion(index, offset)}
				onremove={() => removeQuestion(index)}
			/>
		{:else}
			<div class="helper">No questions yet. Add the first one below.</div>
		{/each}

		{#if atLimit}
			<div class="helper">You've reached the limit of {MAX_INTAKE_QUESTIONS} questions.</div>
		{:else}
			<div>
				<Button variant="secondary" onclick={addQuestion}>Add question</Button>
			</div>
		{/if}

		{#if form && 'message' in form && form.message}
			<div class="error" role="alert">{form.message}</div>
		{/if}

		<div class="save-bar">
			<Button type="submit">Save form</Button>
		</div>
	</form>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 20px;
		max-width: 760px;
	}

	.back {
		font-size: 14px;
		color: var(--text-secondary);
		text-decoration: none;
	}

	.builder {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.helper {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.error {
		font-size: 13px;
		color: var(--danger);
	}

	.save-bar {
		display: flex;
		justify-content: center;
		position: sticky;
		bottom: 0;
		padding: 12px 0;
	}
</style>
