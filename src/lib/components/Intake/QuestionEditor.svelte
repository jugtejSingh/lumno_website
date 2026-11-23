<script lang="ts">
	import Input from '$lib/components/utils/Input.svelte';
	import {
		INTAKE_QUESTION_TYPES,
		INTAKE_QUESTION_TYPE_LABELS,
		MAX_INTAKE_CHOICES,
		isChoiceType,
		type IntakeQuestion
	} from '$lib/types/intake';

	// Edits one question in the builder. The whole list is posted as JSON by the page, so
	// nothing here has a form `name`.
	let {
		question = $bindable(),
		position,
		isFirst,
		isLast,
		onmove,
		onremove
	}: {
		question: IntakeQuestion;
		position: number;
		isFirst: boolean;
		isLast: boolean;
		onmove: (offset: number) => void;
		onremove: () => void;
	} = $props();

	const typeSelectId = $derived(`type-${question.id}`);
	const requiredId = $derived(`required-${question.id}`);

	function changeType(event: Event) {
		const type = (event.currentTarget as HTMLSelectElement).value as IntakeQuestion['type'];
		question.type = type;
		if (isChoiceType(type) && (!question.choices || question.choices.length === 0)) {
			question.choices = ['', ''];
		}
	}

	function addChoice() {
		const choices = question.choices ?? [];
		if (choices.length >= MAX_INTAKE_CHOICES) {
			return;
		}
		question.choices = [...choices, ''];
	}

	function removeChoice(index: number) {
		const next: string[] = [];
		const choices = question.choices ?? [];
		for (let i = 0; i < choices.length; i++) {
			if (i !== index) {
				next.push(choices[i]);
			}
		}
		question.choices = next;
	}

	function updateChoice(index: number, event: Event) {
		const choices = [...(question.choices ?? [])];
		choices[index] = (event.currentTarget as HTMLInputElement).value;
		question.choices = choices;
	}

	function updateDescription(value: string) {
		question.description = value;
	}
</script>

<div class="question">
	<div class="top">
		<div class="position">Question {position}</div>
		<div class="actions">
			<button
				type="button"
				class="icon-btn"
				aria-label="Move question {position} up"
				disabled={isFirst}
				onclick={() => onmove(-1)}>↑</button
			>
			<button
				type="button"
				class="icon-btn"
				aria-label="Move question {position} down"
				disabled={isLast}
				onclick={() => onmove(1)}>↓</button
			>
			<button
				type="button"
				class="icon-btn"
				aria-label="Remove question {position}"
				onclick={onremove}>✕</button
			>
		</div>
	</div>

	<Input label="Question" placeholder="e.g. What brings you to therapy?" bind:value={question.label} />
	<Input
		label="Helper text (optional)"
		placeholder="Shown under the question"
		bind:value={() => question.description ?? '', updateDescription}
	/>

	<div class="row">
		<label class="field-label" for={typeSelectId}>Answer type</label>
		<select class="select" id={typeSelectId} value={question.type} onchange={changeType}>
			{#each INTAKE_QUESTION_TYPES as type (type)}
				<option value={type}>{INTAKE_QUESTION_TYPE_LABELS[type]}</option>
			{/each}
		</select>
		<label class="checkbox" for={requiredId}>
			<input type="checkbox" id={requiredId} bind:checked={question.required} />
			Required
		</label>
	</div>

	{#if isChoiceType(question.type)}
		<div class="choices">
			<div class="field-label">Choices</div>
			{#each question.choices ?? [] as choice, index (index)}
				<div class="choice-row">
					<input
						class="choice-input"
						value={choice}
						placeholder="Choice {index + 1}"
						aria-label="Choice {index + 1}"
						oninput={(event) => updateChoice(index, event)}
					/>
					<button
						type="button"
						class="icon-btn"
						aria-label="Remove choice {index + 1}"
						onclick={() => removeChoice(index)}>✕</button
					>
				</div>
			{/each}
			{#if (question.choices ?? []).length < MAX_INTAKE_CHOICES}
				<div>
					<button type="button" class="link-btn" onclick={addChoice}>+ Add choice</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.question {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-card);
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.position {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-secondary);
	}

	.actions {
		display: flex;
		gap: 4px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.select,
	.choice-input {
		font: inherit;
		font-size: 14px;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 6px 8px;
	}

	.checkbox {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		color: var(--text-primary);
		cursor: pointer;
	}

	.choices {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.choice-row {
		display: flex;
		gap: 8px;
	}

	.choice-input {
		flex: 1;
		min-width: 0;
	}

	.icon-btn {
		width: 32px;
		height: 32px;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
		color: var(--text-secondary);
		font-size: 14px;
		cursor: pointer;
	}

	.icon-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.link-btn {
		border: 0;
		background: none;
		padding: 0;
		font: inherit;
		font-size: 14px;
		color: var(--accent-primary);
		cursor: pointer;
	}
</style>
