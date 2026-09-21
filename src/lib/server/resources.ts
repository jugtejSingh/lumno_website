import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { client, clientResource } from '$lib/server/db/schema';
import { deleteObject, headObject, presignedPost, signedUrl } from '$lib/server/storage';
import { logError } from '$lib/server/log';
import {
	MAX_RESOURCE_BYTES,
	RESOURCE_FILE_TYPES,
	RESOURCE_TAGS,
	type ResourceRow,
	type ResourceTag,
	type ResourceUploader,
	type ResourceUploadTicket
} from '$lib/types/resources';

// Who is acting on which therapist↔client pair. Every function below scopes its
// queries and S3 keys to this, so it must only ever come from therapistScope()
// or clientScope(), never be built from request input.
export type ResourceScope = {
	therapistId: string;
	clientId: string;
	role: ResourceUploader;
};

const MAX_NAME_LENGTH = 200;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function therapistScope(therapistId: string, clientId: string): Promise<ResourceScope | null> {
	const [row] = await db
		.select({ id: client.id })
		.from(client)
		.where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));
	if (!row) {
		return null;
	}
	return { therapistId, clientId, role: 'therapist' };
}

// clientId must be locals.clientId — hooks only set it to one of this user's own rows.
export async function clientScope(clientId: string): Promise<ResourceScope | null> {
	const [row] = await db
		.select({ therapistId: client.therapistId })
		.from(client)
		.where(eq(client.id, clientId));
	if (!row) {
		return null;
	}
	return { therapistId: row.therapistId, clientId, role: 'client' };
}

function keyPrefix(scope: ResourceScope): string {
	return `resources/${scope.therapistId}/${scope.clientId}/`;
}

// A key is only ever accepted back from the browser if it sits directly under
// this scope's own prefix — a key minted for any other client fails here.
export function isKeyInScope(scope: ResourceScope, key: string): boolean {
	const prefix = keyPrefix(scope);
	if (!key.startsWith(prefix)) {
		return false;
	}
	return UUID_PATTERN.test(key.slice(prefix.length));
}

function parseName(raw: string): string | null {
	const name = raw.trim();
	if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
		return null;
	}
	return name;
}

function parseTag(raw: string): ResourceTag | null {
	for (const tag of RESOURCE_TAGS) {
		if (tag === raw) {
			return tag;
		}
	}
	return null;
}

// http(s) only — rejects javascript:, data: and friends.
export function parseResourceUrl(raw: string): string | null {
	let parsed: URL;
	try {
		parsed = new URL(raw.trim());
	} catch {
		return null;
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return null;
	}
	return parsed.toString();
}

export async function listResources(scope: ResourceScope): Promise<ResourceRow[]> {
	const rows = await db
		.select()
		.from(clientResource)
		.where(
			and(eq(clientResource.clientId, scope.clientId), eq(clientResource.therapistId, scope.therapistId))
		)
		.orderBy(desc(clientResource.createdAt));

	const result: ResourceRow[] = [];
	for (const row of rows) {
		let href: string;
		if (row.kind === 'file') {
			href = await signedUrl(row.s3Key!, row.name);
		} else {
			href = row.url!;
		}
		result.push({
			id: row.id,
			kind: row.kind,
			name: row.name,
			tag: row.tag,
			href,
			uploadedBy: row.uploadedBy,
			createdAt: row.createdAt
		});
	}
	return result;
}

// Step 1 of a file upload: mint a fresh key under this scope and a presigned
// POST that only accepts that key, type and size.
export async function requestResourceUpload(
	scope: ResourceScope,
	contentType: string,
	sizeBytes: number
): Promise<ResourceUploadTicket | { error: 'bad_type' | 'too_large' }> {
	if (!RESOURCE_FILE_TYPES.includes(contentType)) {
		return { error: 'bad_type' };
	}
	if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_RESOURCE_BYTES) {
		return { error: 'too_large' };
	}
	const key = `${keyPrefix(scope)}${randomUUID()}`;
	const post = await presignedPost(key, contentType, MAX_RESOURCE_BYTES);
	return { url: post.url, fields: post.fields, key };
}

// Step 2: the browser has POSTed to S3; register the object. The key is
// re-checked against this scope and S3 is asked what actually landed.
export async function confirmResourceUpload(
	scope: ResourceScope,
	key: string,
	rawName: string,
	rawTag: string
): Promise<{ id: string } | { error: 'invalid' | 'bad_key' | 'not_uploaded' | 'duplicate' }> {
	const name = parseName(rawName);
	const tag = parseTag(rawTag);
	if (!name || !tag) {
		return { error: 'invalid' };
	}
	if (!isKeyInScope(scope, key)) {
		return { error: 'bad_key' };
	}

	const object = await headObject(key);
	if (!object) {
		return { error: 'not_uploaded' };
	}
	if (!object.contentType || !RESOURCE_FILE_TYPES.includes(object.contentType)) {
		return { error: 'not_uploaded' };
	}
	if (object.sizeBytes > MAX_RESOURCE_BYTES) {
		return { error: 'not_uploaded' };
	}

	const [row] = await db
		.insert(clientResource)
		.values({
			therapistId: scope.therapistId,
			clientId: scope.clientId,
			kind: 'file',
			name,
			tag,
			s3Key: key,
			contentType: object.contentType,
			sizeBytes: object.sizeBytes,
			uploadedBy: scope.role
		})
		.onConflictDoNothing({ target: clientResource.s3Key })
		.returning({ id: clientResource.id });
	if (!row) {
		return { error: 'duplicate' };
	}
	return { id: row.id };
}

export async function addResourceLink(
	scope: ResourceScope,
	rawUrl: string,
	rawName: string,
	rawTag: string
): Promise<{ id: string } | { error: 'invalid' | 'bad_url' }> {
	const name = parseName(rawName);
	const tag = parseTag(rawTag);
	if (!name || !tag) {
		return { error: 'invalid' };
	}
	const url = parseResourceUrl(rawUrl);
	if (!url) {
		return { error: 'bad_url' };
	}

	const [row] = await db
		.insert(clientResource)
		.values({
			therapistId: scope.therapistId,
			clientId: scope.clientId,
			kind: 'link',
			name,
			tag,
			url,
			uploadedBy: scope.role
		})
		.returning({ id: clientResource.id });
	return { id: row.id };
}

// Only the uploader can delete — a therapist can't remove a client's prescription
// and vice versa.
export async function deleteResource(
	scope: ResourceScope,
	resourceId: string
): Promise<{ ok: true } | { error: 'not_found' }> {
	const [row] = await db
		.delete(clientResource)
		.where(
			and(
				eq(clientResource.id, resourceId),
				eq(clientResource.clientId, scope.clientId),
				eq(clientResource.therapistId, scope.therapistId),
				eq(clientResource.uploadedBy, scope.role)
			)
		)
		.returning({ s3Key: clientResource.s3Key });
	if (!row) {
		return { error: 'not_found' };
	}

	if (row.s3Key) {
		try {
			await deleteObject(row.s3Key);
		} catch (err) {
			// ponytail: an orphaned object is unreachable without its row, just log it
			logError('resources.delete', err, { key: row.s3Key });
		}
	}
	return { ok: true };
}
