import { eq } from 'drizzle-orm';
import { fail, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { client as clientTable } from '$lib/server/db/schema';
import { cancelAppointment, listUpcomingAppointmentsForClient } from '$lib/server/appointments';
import { getActivePackForClient, listPacksForClient } from '$lib/server/payments';
import { getPaymentSettings } from '$lib/server/paymentSettings';
import { resolveReschedulePolicyOutcome } from '$lib/server/paymentPolicy';

// The client's upcoming sessions, shared by the portal home and calendar pages.

const modalityLabel: Record<string, string> = {
	online: 'Online session',
	in_person: 'In-person session'
};

export type PortalSession = {
	id: string;
	when: string;
	type: string;
	status: string;
	tone: 'success';
	meetLink: string | null;
	rescheduleChargesRegularRate: boolean;
};

export async function loadPortalSessions(clientId: string, therapistId: string, timezone: string) {
	const [upcoming, paymentSettings, activePack, clientPacks] = await Promise.all([
		listUpcomingAppointmentsForClient(clientId, timezone),
		getPaymentSettings(therapistId),
		getActivePackForClient(clientId),
		listPacksForClient(therapistId, clientId)
	]);

	// sessions left on the current pack; null = no pack in play. packUsedUp is true once
	// the client's latest pack has run out and no new one has been added.
	let packRemaining: number | null = null;
	let packUsedUp = false;
	if (activePack) {
		packRemaining = activePack.remaining;
	} else {
		const latestPack = clientPacks[clientPacks.length - 1];
		if (latestPack && latestPack.status === 'completed') {
			packUsedUp = true;
		}
	}

	const sessions: PortalSession[] = [];
	for (const appt of upcoming) {
		// moving a pack session inside the 100% window loses its credit, and with no credit
		// left the replacement session is billed at the regular rate
		const rescheduleTier = resolveReschedulePolicyOutcome(appt.startAt, paymentSettings, 0).tier;
		const noCreditLeft = packRemaining === null || packRemaining <= 0;
		sessions.push({
			id: appt.id,
			when: appt.when,
			type: modalityLabel[appt.modality] ?? 'Session',
			status: appt.status,
			tone: 'success',
			meetLink: appt.meetLink,
			rescheduleChargesRegularRate: appt.packId !== null && rescheduleTier === 'full' && noCreditLeft
		});
	}

	return { upcoming, sessions, packRemaining, packUsedUp, paymentSettings };
}

// Form action body for ?/cancelSession. Lives on both the home and calendar pages, since
// both list sessions with a Cancel button.
export async function cancelSessionAction(event: RequestEvent) {
	if (!event.locals.clientId) {
		return fail(401);
	}

	const [clientRow] = await db
		.select({ therapistId: clientTable.therapistId })
		.from(clientTable)
		.where(eq(clientTable.id, event.locals.clientId));
	if (!clientRow) {
		return fail(403);
	}

	const formData = await event.request.formData();
	const appointmentId = formData.get('appointmentId')?.toString() ?? '';

	const result = await cancelAppointment(clientRow.therapistId, appointmentId, event.locals.clientId);
	if ('error' in result) {
		return fail(400, { message: 'That session could not be found' });
	}
}
