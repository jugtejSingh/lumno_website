<script lang="ts">
	import Input from '$lib/components/utils/Input.svelte';
	import Select from '$lib/components/utils/Select.svelte';
	import Textarea from '$lib/components/utils/Textarea.svelte';
	import { GST_STATES, type InvoiceParty } from '$lib/invoice';

	// Rendered inside a Dialog whose title names the party, so no heading here.
	let {
		nameLabel,
		gstinInfo,
		party = $bindable()
	}: {
		nameLabel: string;
		gstinInfo: string;
		party: InvoiceParty;
	} = $props();

	const NO_STATE_LABEL = 'Choose a state';

	// Select works on display labels; the invoice stores the 2-digit state code.
	const stateLabels: string[] = [NO_STATE_LABEL];
	for (const state of GST_STATES) {
		stateLabels.push(`${state.code} · ${state.name}`);
	}

	function getStateLabel(): string {
		for (const state of GST_STATES) {
			if (state.code === party.stateCode) {
				return `${state.code} · ${state.name}`;
			}
		}
		return NO_STATE_LABEL;
	}

	function setStateLabel(label: string) {
		if (label === NO_STATE_LABEL) {
			party.stateCode = '';
		} else {
			party.stateCode = label.slice(0, 2);
		}
	}
</script>

<div class="party">
	<Input label={nameLabel} bind:value={party.name} />
	<Textarea label="Address" rows={3} bind:value={party.address} />
	<div class="row">
		<Input label="GSTIN" info={gstinInfo} bind:value={party.gstin} />
		<Select label="State" options={stateLabels} bind:value={getStateLabel, setStateLabel} />
	</div>
</div>

<style>
	.party {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	@media (max-width: 520px) {
		.row {
			grid-template-columns: 1fr;
		}
	}
</style>
