<script lang="ts">
	import {
		MAX_INTAKE_LONG_ANSWER_LENGTH,
		MAX_INTAKE_SHORT_ANSWER_LENGTH,
		intakeAnswerInputName,
		type IntakeQuestion
	} from '$lib/types/intake';

	// One question on the public form, rendered by type. Native inputs so `required`,
	// date pickers and email keyboards come from the browser; the server re-checks everything.
	let { question, error }: { question: IntakeQuestion; error?: string } = $props();

	const inputName = $derived(intakeAnswerInputName(question.id));
	const inputId = $derived(`intake-${question.id}`);
	const describedBy = $derived(question.description ? `${inputId}-desc` : undefined);
</script>

<div class="field">
	{#if question.type === 'single_choice' || question.type === 'multiple_choice' || question.type === 'yes_no'}
		<fieldset class="group" aria-describedby={describedBy}>
			<legend class="label">
				{question.label}{#if question.required}<span class="req" aria-hidden="true"> *</span>{/if}
			</legend>
			{#if question.description}
				<div class="desc" id={describedBy}>{question.description}</div>
			{/if}
			{#if question.type === 'yes_no'}
				<label class="option">
					<input type="radio" name={inputName} value="yes" required={question.required} /> Yes
				</label>
				<label class="option">
					<input type="radio" name={inputName} value="no" required={question.required} /> No
				</label>
			{:else if question.type === 'single_choice'}
				{#each question.choices ?? [] as choice (choice)}
					<label class="option">
						<input type="radio" name={inputName} value={choice} required={question.required} />
						{choice}
					</label>
				{/each}
			{:else}
				{#each question.choices ?? [] as choice (choice)}
					<label class="option">
						<input type="checkbox" name={inputName} value={choice} />
						{choice}
					</label>
				{/each}
			{/if}
		</fieldset>
	{:else}
		<label class="label" for={inputId}>
			{question.label}{#if question.required}<span class="req" aria-hidden="true"> *</span>{/if}
		</label>
		{#if question.description}
			<div class="desc" id={describedBy}>{question.description}</div>
		{/if}
		{#if question.type === 'long_text'}
			<textarea
				class="control"
				id={inputId}
				name={inputName}
				rows="5"
				maxlength={MAX_INTAKE_LONG_ANSWER_LENGTH}
				required={question.required}
				aria-describedby={describedBy}
				aria-invalid={error ? 'true' : undefined}
			></textarea>
		{:else if question.type === 'date'}
			<input
				class="control"
				type="date"
				id={inputId}
				name={inputName}
				required={question.required}
				aria-describedby={describedBy}
				aria-invalid={error ? 'true' : undefined}
			/>
		{:else if question.type === 'number'}
			<input
				class="control"
				type="number"
				step="any"
				id={inputId}
				name={inputName}
				required={question.required}
				aria-describedby={describedBy}
				aria-invalid={error ? 'true' : undefined}
			/>
		{:else if question.type === 'email'}
			<input
				class="control"
				type="email"
				autocomplete="email"
				id={inputId}
				name={inputName}
				maxlength="200"
				required={question.required}
				aria-describedby={describedBy}
				aria-invalid={error ? 'true' : undefined}
			/>
		{:else if question.type === 'phone'}
			<input
				class="control"
				type="tel"
				autocomplete="tel"
				placeholder="+910000000000"
				id={inputId}
				name={inputName}
				required={question.required}
				aria-describedby={describedBy}
				aria-invalid={error ? 'true' : undefined}
			/>
		{:else if question.type === 'name'}
			<input
				class="control"
				type="text"
				autocomplete="name"
				id={inputId}
				name={inputName}
				maxlength="100"
				required={question.required}
				aria-describedby={describedBy}
				aria-invalid={error ? 'true' : undefined}
			/>
		{:else}
			<input
				class="control"
				type="text"
				id={inputId}
				name={inputName}
				maxlength={MAX_INTAKE_SHORT_ANSWER_LENGTH}
				required={question.required}
				aria-describedby={describedBy}
				aria-invalid={error ? 'true' : undefined}
			/>
		{/if}
	{/if}
	{#if error}
		<div class="error" role="alert">{error}</div>
	{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.group {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.label {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
		padding: 0;
	}

	.req {
		color: var(--text-muted);
	}

	.desc {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.option {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--text-primary);
		cursor: pointer;
	}

	.control {
		box-sizing: border-box;
		width: 100%;
		font: inherit;
		font-size: 14px;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-inset);
		padding: 8px 10px;
	}

	.error {
		font-size: 13px;
		color: var(--danger);
	}
</style>
