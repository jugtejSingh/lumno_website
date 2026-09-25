import { getContext, setContext } from 'svelte';

// Lets a slot's reserve dropdown ask which other weekly slots a client already holds, without
// the weekly dialog passing the whole week down through every row.
export type HeldSlotsLookup = (clientId: string, exceptSlotId: string) => string[];

const KEY = Symbol('reserved-slots-lookup');

export function provideHeldSlotsLookup(lookup: HeldSlotsLookup) {
	setContext(KEY, lookup);
}

export function useHeldSlotsLookup(): HeldSlotsLookup | undefined {
	return getContext<HeldSlotsLookup | undefined>(KEY);
}
