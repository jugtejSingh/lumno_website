import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { clientResource } from '$lib/server/db/schema';
import {
	addResourceLink,
	clientScope,
	confirmResourceUpload,
	deleteResource,
	listResources,
	requestResourceUpload,
	therapistScope,
	type ResourceScope
} from '$lib/server/resources';
import { deleteObject, headObject } from '$lib/server/storage';
import { resetDb, mkTherapist, mkClient } from './helpers';

// S3 is mocked: headObject reports whatever the test says landed.
vi.mock('$lib/server/storage', () => ({
	presignedPost: vi.fn(async () => ({ url: 'https://s3.test/bucket', fields: { policy: 'p' } })),
	headObject: vi.fn(async () => ({ sizeBytes: 1000, contentType: 'application/pdf' })),
	signedUrl: vi.fn(async (key: string) => `https://signed.test/${key}`),
	deleteObject: vi.fn(async () => {})
}));

let therapistId: string;
let clientId: string;
let therapistSide: ResourceScope;
let clientSide: ResourceScope;

beforeEach(async () => {
	await resetDb();
	vi.clearAllMocks();
	therapistId = (await mkTherapist()).id;
	clientId = (await mkClient(therapistId)).id;
	therapistSide = (await therapistScope(therapistId, clientId))!;
	clientSide = (await clientScope(clientId))!;
});

async function uploadAs(scope: ResourceScope, name = 'Prescription') {
	const ticket = await requestResourceUpload(scope, 'application/pdf', 1000);
	if ('error' in ticket) {
		throw new Error(ticket.error);
	}
	const confirmed = await confirmResourceUpload(scope, ticket.key, name, 'prescription');
	return { ticket, confirmed };
}

describe('scopes', () => {
	it('refuses a therapist scope for another therapist’s client', async () => {
		const otherTherapistId = (await mkTherapist()).id;
		expect(await therapistScope(otherTherapistId, clientId)).toBeNull();
	});

	it('client scope carries the owning therapist', () => {
		expect(clientSide).toEqual({ therapistId, clientId, role: 'client' });
	});
});

describe('file upload', () => {
	it('mints a key under this therapist/client and saves the row on confirm', async () => {
		const { ticket, confirmed } = await uploadAs(clientSide);
		expect(ticket.key).toMatch(new RegExp(`^resources/${therapistId}/${clientId}/[0-9a-f-]{36}$`));
		expect('id' in confirmed).toBe(true);

		const [row] = await db.select().from(clientResource);
		expect(row).toMatchObject({ kind: 'file', s3Key: ticket.key, uploadedBy: 'client', tag: 'prescription' });
	});

	it('rejects disallowed types and oversize files before signing', async () => {
		expect(await requestResourceUpload(therapistSide, 'text/html', 1000)).toEqual({ error: 'bad_type' });
		expect(await requestResourceUpload(therapistSide, 'application/pdf', 21 * 1024 * 1024)).toEqual({
			error: 'too_large'
		});
	});

	it('rejects confirming a key minted for another client', async () => {
		const otherClientId = (await mkClient(therapistId)).id;
		const otherScope = (await clientScope(otherClientId))!;
		const ticket = await requestResourceUpload(otherScope, 'application/pdf', 1000);
		if ('error' in ticket) {
			throw new Error(ticket.error);
		}

		expect(await confirmResourceUpload(clientSide, ticket.key, 'Stolen', 'prescription')).toEqual({
			error: 'bad_key'
		});
		expect(await confirmResourceUpload(therapistSide, ticket.key, 'Stolen', 'prescription')).toEqual({
			error: 'bad_key'
		});
	});

	it('rejects keys with path tricks under the right prefix', async () => {
		const key = `resources/${therapistId}/${clientId}/../other/x`;
		expect(await confirmResourceUpload(clientSide, key, 'x', 'prescription')).toEqual({ error: 'bad_key' });
	});

	it('refuses to register the same key twice', async () => {
		const { ticket } = await uploadAs(clientSide);
		expect(await confirmResourceUpload(therapistSide, ticket.key, 'Again', 'prescription')).toEqual({
			error: 'duplicate'
		});
	});

	it('refuses confirm when nothing landed in S3', async () => {
		vi.mocked(headObject).mockResolvedValueOnce(null);
		const ticket = await requestResourceUpload(clientSide, 'application/pdf', 1000);
		if ('error' in ticket) {
			throw new Error(ticket.error);
		}
		expect(await confirmResourceUpload(clientSide, ticket.key, 'x', 'prescription')).toEqual({
			error: 'not_uploaded'
		});
	});

	it('requires a name and a known tag', async () => {
		const ticket = await requestResourceUpload(clientSide, 'application/pdf', 1000);
		if ('error' in ticket) {
			throw new Error(ticket.error);
		}
		expect(await confirmResourceUpload(clientSide, ticket.key, '  ', 'prescription')).toEqual({
			error: 'invalid'
		});
		expect(await confirmResourceUpload(clientSide, ticket.key, 'x', 'bogus')).toEqual({ error: 'invalid' });
	});
});

describe('links', () => {
	it('accepts http(s) and rejects other schemes', async () => {
		expect('id' in (await addResourceLink(therapistSide, 'https://example.com/read', 'Reading', 'reading'))).toBe(
			true
		);
		expect(await addResourceLink(therapistSide, 'javascript:alert(1)', 'x', 'reading')).toEqual({
			error: 'bad_url'
		});
		expect(await addResourceLink(therapistSide, 'not a url', 'x', 'reading')).toEqual({ error: 'bad_url' });
	});
});

describe('listing', () => {
	it('both sides see every resource for the pair, and nothing from other clients', async () => {
		await uploadAs(clientSide, 'From client');
		await addResourceLink(therapistSide, 'https://example.com', 'From therapist', 'reading');
		const otherClientId = (await mkClient(therapistId)).id;
		await addResourceLink((await clientScope(otherClientId))!, 'https://example.com', 'Other', 'other');

		const seenByTherapist = await listResources(therapistSide);
		const seenByClient = await listResources(clientSide);
		expect(seenByTherapist.map((r) => r.name).sort()).toEqual(['From client', 'From therapist']);
		expect(seenByClient.map((r) => r.name).sort()).toEqual(['From client', 'From therapist']);
	});
});

describe('deleteResource', () => {
	it('only the uploader can delete, and the S3 object goes with it', async () => {
		const { confirmed, ticket } = await uploadAs(clientSide);
		if (!('id' in confirmed)) {
			throw new Error('upload failed');
		}

		expect(await deleteResource(therapistSide, confirmed.id)).toEqual({ error: 'not_found' });
		expect(await db.select().from(clientResource).where(eq(clientResource.id, confirmed.id))).toHaveLength(1);

		expect(await deleteResource(clientSide, confirmed.id)).toEqual({ ok: true });
		expect(deleteObject).toHaveBeenCalledWith(ticket.key);
		expect(await db.select().from(clientResource)).toHaveLength(0);
	});

	it('cannot delete another client’s resource even as its uploader role', async () => {
		const otherClientId = (await mkClient(therapistId)).id;
		const otherScope = (await clientScope(otherClientId))!;
		const link = await addResourceLink(otherScope, 'https://example.com', 'Theirs', 'other');
		if (!('id' in link)) {
			throw new Error('link failed');
		}
		expect(await deleteResource(clientSide, link.id)).toEqual({ error: 'not_found' });
	});
});
