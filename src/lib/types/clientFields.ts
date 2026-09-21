// A therapist-defined heading shown on every client's profile. `id` is stable so a
// rename keeps the values stored under it (client.customFields is keyed by id).
export type ClientFieldHeading = {
	id: string;
	label: string;
};

// heading id -> free text the therapist wrote under that heading
export type ClientFieldValues = Record<string, string>;

export const MAX_CLIENT_FIELD_HEADINGS = 20;
export const MAX_CLIENT_FIELD_LABEL_LENGTH = 60;
export const MAX_CLIENT_FIELD_VALUE_LENGTH = 5000;

// Form input name for one heading's value on the client add/edit form.
export function clientFieldInputName(headingId: string): string {
	return `field:${headingId}`;
}
