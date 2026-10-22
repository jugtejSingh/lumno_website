import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { setClientProfile, setClientTimezone } from '$lib/server/clients';
import { parsePhone } from '$lib/phone';
import { parseClientProfile } from '$lib/clientProfile';
import {
	getPendingPhone,
	savePhone,
	sendPhoneCode,
	verifyPhoneCode
} from '$lib/server/phoneVerification';

export const load: PageServerLoad = async (event) => {
	const { client } = await event.parent();

	return {
		// verified number (or '') and the one waiting to be verified (or '')
		clientPhone: client.phone ?? '',
		pendingPhone: (await getPendingPhone(client.id)) ?? '',
		clientTimezone: client.timezone ?? '',
		timezoneOptions: Intl.supportedValuesOf('timeZone'),
		clientProfile: {
			dateOfBirth: client.dateOfBirth ?? '',
			gender: client.gender ?? '',
			city: client.city ?? '',
			state: client.state ?? '',
			country: client.country ?? ''
		}
	};
};

export const actions: Actions = {
	// the client editing their own phone number and display timezone. A new phone only
	// becomes pending; it reaches client.phone once verified (see savePhone).
	saveDetails: async (event) => {
		if (!event.locals.clientId) {
			return fail(401);
		}

		const formData = await event.request.formData();
		const parsedPhone = parsePhone(formData.get('phone')?.toString());
		if ('error' in parsedPhone) {
			return fail(400, { message: parsedPhone.error });
		}

		// '' means "use the therapist's timezone" — cleared back to null
		const timezoneRaw = formData.get('timezone')?.toString() ?? '';
		if (timezoneRaw && !Intl.supportedValuesOf('timeZone').includes(timezoneRaw)) {
			return fail(400, { message: 'Pick a valid timezone' });
		}

		await savePhone(event.locals.clientId, parsedPhone.phone);
		await setClientTimezone(event.locals.clientId, timezoneRaw || null);
	},

	// the client's own date of birth / gender / location, all required. The therapist
	// sees these read-only.
	saveProfile: async (event) => {
		if (!event.locals.clientId) {
			return fail(403, { message: 'Not a client' });
		}
		const parsedProfile = parseClientProfile(await event.request.formData());
		if ('error' in parsedProfile) {
			return fail(400, { profileMessage: parsedProfile.error });
		}
		await setClientProfile(event.locals.clientId, parsedProfile.profile);
	},

	// WhatsApp code to the client's pending number (see PhoneVerification.svelte)
	sendPhoneCode: async (event) => {
		if (!event.locals.clientId) {
			return fail(403, { message: 'Not a client' });
		}
		const result = await sendPhoneCode(event.locals.clientId);
		if (!result.ok) {
			return fail(400, { reason: result.reason });
		}
		return { ok: true };
	},

	verifyPhoneCode: async (event) => {
		if (!event.locals.clientId) {
			return fail(403, { message: 'Not a client' });
		}
		const formData = await event.request.formData();
		const result = await verifyPhoneCode(
			event.locals.clientId,
			formData.get('code')?.toString() ?? ''
		);
		if (!result.ok) {
			return fail(400, result);
		}
		return { ok: true };
	}
};
