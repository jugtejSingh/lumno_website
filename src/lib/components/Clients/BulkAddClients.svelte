<script lang="ts">
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import Textarea from '$lib/components/utils/Textarea.svelte';
	import BulkClientRow from './BulkClientRow.svelte';
	import BulkAddResults from './BulkAddResults.svelte';
	import { enhance } from '$lib/enhance';
	import {
		BULK_MAX_TEXT_LENGTH,
		flagRows,
		parseRate,
		type BulkAddRowResult,
		type FlaggedBulkRow
	} from '$lib/bulkClientRows';

	// Three steps in one dialog: paste text -> review what the AI found -> results.
	// Nothing is saved until the therapist presses "Add & invite" on the review step.
	let {
		open,
		onclose,
		existingEmails,
		activeCount,
		activeClientLimit,
		bulkImports
	}: {
		open: boolean;
		onclose: () => void;
		existingEmails: string[];
		activeCount: number;
		// null = no cap
		activeClientLimit: number | null;
		// limit null = unlimited
		bulkImports: { used: number; limit: number | null };
	} = $props();

	type DraftRow = { id: number; name: string; email: string; rate: number };

	let step = $state<'paste' | 'review' | 'results'>('paste');
	let text = $state('');
	// fills in every row the AI found no price for, and every row added by hand; blank = 0
	let basePrice = $state<number | null>(null);
	let rows = $state<DraftRow[]>([]);
	let truncated = $state(false);
	let error = $state('');
	let results = $state<BulkAddRowResult[]>([]);
	let nextId = 0;

	const existingSet = $derived.by(() => {
		const set = new Set<string>();
		for (const email of existingEmails) {
			set.add(email.toLowerCase());
		}
		return set;
	});

	// re-checked on every edit — the server checks again on save
	const flagged = $derived(flagRows(rows, existingSet));

	const readyCount = $derived.by(() => {
		let count = 0;
		for (const row of flagged) {
			if (row.flags.length === 0) {
				count += 1;
			}
		}
		return count;
	});

	// how many of the ready rows fit under the plan's active cap
	const activeRoom = $derived.by(() => {
		if (activeClientLimit === null) {
			return readyCount;
		}
		const room = Math.max(0, activeClientLimit - activeCount);
		return Math.min(room, readyCount);
	});

	const importsLeft = $derived.by(() => {
		if (bulkImports.limit === null) {
			return null;
		}
		return Math.max(0, bulkImports.limit - bulkImports.used);
	});

	function reset() {
		step = 'paste';
		text = '';
		basePrice = null;
		rows = [];
		truncated = false;
		error = '';
		results = [];
	}

	function close() {
		reset();
		onclose();
	}

	function baseRate(): number {
		const parsed = parseRate(basePrice);
		if (parsed === null) {
			return 0;
		}
		return parsed;
	}

	function loadRows(extracted: FlaggedBulkRow[]) {
		const draft: DraftRow[] = [];
		for (const row of extracted) {
			let rate = row.rate;
			if (rate === null) {
				rate = baseRate();
			}
			draft.push({ id: nextId, name: row.name, email: row.email, rate });
			nextId += 1;
		}
		rows = draft;
	}

	function addRow() {
		rows.push({ id: nextId, name: '', email: '', rate: baseRate() });
		nextId += 1;
	}

	function removeRow(id: number) {
		const kept: DraftRow[] = [];
		for (const row of rows) {
			if (row.id !== id) {
				kept.push(row);
			}
		}
		rows = kept;
	}

	const rowsJson = $derived.by(() => {
		const plain: { name: string; email: string; rate: number }[] = [];
		for (const row of rows) {
			plain.push({ name: row.name, email: row.email, rate: row.rate });
		}
		return JSON.stringify(plain);
	});
</script>

<Dialog {open} title="Add many clients" width="clamp(300px, 60vw, 720px)" onclose={close}>
	{#if step === 'paste'}
		<form
			class="step"
			method="POST"
			action="?/extract"
			use:enhance={() => {
				error = '';
				return async ({ result, update }) => {
					if (result.type === 'success' && result.data && Array.isArray(result.data.bulkRows)) {
						loadRows(result.data.bulkRows as FlaggedBulkRow[]);
						truncated = Boolean(result.data.bulkTruncated);
						step = 'review';
					} else if (result.type === 'failure' && result.data) {
						error = String(result.data.bulkError ?? 'Something went wrong. Please try again.');
					}
					// refreshes the imports-left count
					await update({ reset: false });
				};
			}}
		>
			<label class="base-price">
				<span>Your usual price per session</span>
				<input type="number" min="0" step="1" placeholder="0" bind:value={basePrice} />
			</label>
			<div class="hint">
				Paste your client list in any shape — copied spreadsheet cells, a CSV, or a message with names,
				emails and prices. We'll pick out each person's details for you to check before anything is
				saved. Anyone without a price gets your usual price.
			</div>
			<Textarea
				name="text"
				rows={10}
				placeholder={'Jane Doe, jane@example.com\nSam Lee  sam.lee@example.com'}
				bind:value={text}
			/>
			{#if text.length > BULK_MAX_TEXT_LENGTH}
				<div class="form-error">
					That's {text.length.toLocaleString()} characters — paste under
					{BULK_MAX_TEXT_LENGTH.toLocaleString()} at a time.
				</div>
			{/if}
			{#if importsLeft !== null}
				<div class="hint">
					{importsLeft} of {bulkImports.limit} bulk imports left this month.
				</div>
			{/if}
			{#if error}
				<div class="form-error" role="alert">{error}</div>
			{/if}
			<Button
				type="submit"
				variant="primary"
				disabled={!text.trim() || text.length > BULK_MAX_TEXT_LENGTH || importsLeft === 0}
			>
				Find clients
			</Button>
		</form>
	{:else if step === 'review'}
		<form
			class="step"
			method="POST"
			action="?/bulkAdd"
			use:enhance={() => {
				error = '';
				return async ({ result, update }) => {
					if (result.type === 'success' && result.data && Array.isArray(result.data.bulkResults)) {
						results = result.data.bulkResults as BulkAddRowResult[];
						step = 'results';
					} else if (result.type === 'failure' && result.data) {
						error = String(result.data.bulkError ?? 'Something went wrong. Please try again.');
					}
					// reloads the client list behind the dialog
					await update({ reset: false });
				};
			}}
		>
			<input type="hidden" name="rows" value={rowsJson} />
			{#if rows.length === 0}
				<div class="hint">No names or emails were found in that text.</div>
			{:else}
				<div class="hint">
					Found {rows.length}. Check them, fix anything flagged, and remove anyone you don't want to
					invite. Flagged rows are skipped.
				</div>
			{/if}
			{#if truncated}
				<div class="hint">Only the first 200 were kept — add the rest in another import.</div>
			{/if}

			<div class="rows">
				{#each rows as row, index (row.id)}
					<BulkClientRow
						bind:name={row.name}
						bind:email={row.email}
						bind:rate={row.rate}
						flags={flagged[index].flags}
						onremove={() => removeRow(row.id)}
					/>
				{/each}
			</div>
			<div>
				<Button variant="secondary" onclick={addRow}>+ Add row</Button>
			</div>

			{#if activeClientLimit !== null && readyCount > activeRoom}
				<div class="notice">
					Your plan allows {activeClientLimit} active clients. Only {activeRoom} of these will be active
					and able to book. The other {readyCount - activeRoom} will still be invited, but they'll be
					inactive and can't book with you for the time being — they'll see that you'll be able to take
					bookings soon. Upgrade to make them active.
				</div>
			{/if}

			{#if error}
				<div class="form-error" role="alert">{error}</div>
			{/if}
			<div class="buttons">
				<Button variant="secondary" onclick={() => (step = 'paste')}>Back</Button>
				<Button type="submit" variant="primary" disabled={readyCount === 0}>
					Add & invite {readyCount}
				</Button>
			</div>
		</form>
	{:else}
		<BulkAddResults {results} ondone={close} />
	{/if}
</Dialog>

<style>
	.step {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.hint {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.base-price {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.base-price input {
		width: 110px;
		font: inherit;
		font-weight: 400;
		padding: 6px 8px;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
		color: var(--text-primary);
	}

	.rows {
		display: flex;
		flex-direction: column;
		max-height: 45vh;
		overflow-y: auto;
	}

	.notice {
		font-size: 13px;
		color: var(--text-primary);
		background: var(--citrus-300);
		border: 2px dashed var(--citrus-600);
		border-radius: var(--radius-md, 8px);
		padding: 10px 12px;
	}

	.buttons {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.form-error {
		font-size: 13px;
		color: var(--accent-danger, #c0392b);
	}
</style>
