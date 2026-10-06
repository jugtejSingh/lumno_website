import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { setClientPhone, setClientProfile, setClientTimezone } from '$lib/server/clients';
import { parsePhone } from '$lib/phone';
import { parseClientProfile } from '$lib/clientProfile';

export const load: PageServerLoad = async (event) => {
	const { client } = await event.parent();

	return {
		clientPhone: client.phone ?? '',
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
	// the client editing their own phone number and display timezone. Phone is
	// unverified — see setClientPhone.
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

		await setClientPhone(event.locals.clientId, parsedPhone.phone);
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
	}
};
