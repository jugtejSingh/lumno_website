<script lang="ts">
	import type { IntakeAnswer, IntakeAnswers, IntakeQuestion } from '$lib/types/intake';

	// Read-only view of one response, against the questions as they were when it was answered.
	let { questions, answers }: { questions: IntakeQuestion[]; answers: IntakeAnswers } = $props();

	function formatAnswer(answer: IntakeAnswer | undefined): string {
		if (answer === undefined) {
			return '—';
		}
		if (typeof answer === 'boolean') {
			if (answer) {
				return 'Yes';
			}
			return 'No';
		}
		if (Array.isArray(answer)) {
			return answer.join(', ');
		}
		return String(answer);
	}
</script>

<dl class="answers">
	{#each questions as question (question.id)}
		<div class="item">
			<dt class="question">{question.label}</dt>
			<dd class="answer" class:blank={answers[question.id] === undefined}>
				{formatAnswer(answers[question.id])}
			</dd>
		</div>
	{/each}
</dl>

<style>
	.answers {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.item {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.question {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.answer {
		margin: 0;
		font-size: 15px;
		color: var(--text-primary);
		white-space: pre-line;
		overflow-wrap: anywhere;
	}

	.blank {
		color: var(--text-muted);
	}
</style>
