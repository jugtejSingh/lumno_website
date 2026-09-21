import { fail, type RequestEvent } from '@sveltejs/kit';
import {
	addResourceLink,
	confirmResourceUpload,
	deleteResource,
	requestResourceUpload,
	type ResourceScope
} from '$lib/server/resources';

// The four resource form actions, shared by /clients (therapist) and /portal
// (client). Each page only supplies how to resolve the scope for a request.
type ScopeResolver = (event: RequestEvent, formData: FormData) => Promise<ResourceScope | null>;

const errorMessages = {
	bad_type: 'Files must be a PDF, PNG, JPEG or WebP',
	too_large: 'Files must be under 20 MB',
	invalid: 'Give the resource a name and pick a tag',
	bad_key: 'That upload does not belong to this client',
	not_uploaded: 'The upload did not finish — please try again',
	duplicate: 'That file is already saved',
	bad_url: 'Links must start with http:// or https://',
	not_found: 'Resource not found'
} as const;

function field(formData: FormData, name: string): string {
	const value = formData.get(name);
	if (value === null) {
		return '';
	}
	return value.toString();
}

export function resourceActions(resolveScope: ScopeResolver) {
	return {
		requestResourceUpload: async (event: RequestEvent) => {
			const formData = await event.request.formData();
			const scope = await resolveScope(event, formData);
			if (!scope) {
				return fail(403, { resourceMessage: 'Not allowed' });
			}
			const result = await requestResourceUpload(
				scope,
				field(formData, 'contentType'),
				Number(field(formData, 'sizeBytes'))
			);
			if ('error' in result) {
				return fail(400, { resourceMessage: errorMessages[result.error] });
			}
			return { uploadTicket: result };
		},

		confirmResourceUpload: async (event: RequestEvent) => {
			const formData = await event.request.formData();
			const scope = await resolveScope(event, formData);
			if (!scope) {
				return fail(403, { resourceMessage: 'Not allowed' });
			}
			const result = await confirmResourceUpload(
				scope,
				field(formData, 'key'),
				field(formData, 'name'),
				field(formData, 'tag')
			);
			if ('error' in result) {
				return fail(400, { resourceMessage: errorMessages[result.error] });
			}
			return { resourceSaved: true };
		},

		addResourceLink: async (event: RequestEvent) => {
			const formData = await event.request.formData();
			const scope = await resolveScope(event, formData);
			if (!scope) {
				return fail(403, { resourceMessage: 'Not allowed' });
			}
			const result = await addResourceLink(
				scope,
				field(formData, 'url'),
				field(formData, 'name'),
				field(formData, 'tag')
			);
			if ('error' in result) {
				return fail(400, { resourceMessage: errorMessages[result.error] });
			}
			return { resourceSaved: true };
		},

		deleteResource: async (event: RequestEvent) => {
			const formData = await event.request.formData();
			const scope = await resolveScope(event, formData);
			if (!scope) {
				return fail(403, { resourceMessage: 'Not allowed' });
			}
			const result = await deleteResource(scope, field(formData, 'resourceId'));
			if ('error' in result) {
				return fail(400, { resourceMessage: errorMessages[result.error] });
			}
			return { resourceDeleted: true };
		}
	};
}
