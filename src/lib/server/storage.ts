import { env } from '$env/dynamic/private';
import {
	S3Client,
	PutObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

// Private bucket for uploads (pay QR images, client resources). Objects are never
// public — readers get a short-lived signed URL from signedUrl().
// S3_ENDPOINT is optional; set it for an S3-compatible host (R2, MinIO).

let client: S3Client | undefined;

function required(name: string): string {
	const value = env[name];
	if (!value) {
		throw new Error(`${name} is not set`);
	}
	return value;
}

function s3(): S3Client {
	if (!client) {
		client = new S3Client({
			region: required('S3_REGION'),
			endpoint: env.S3_ENDPOINT || undefined,
			forcePathStyle: Boolean(env.S3_ENDPOINT),
			credentials: {
				accessKeyId: required('S3_ACCESS_KEY_ID'),
				secretAccessKey: required('S3_SECRET_ACCESS_KEY')
			}
		});
	}
	return client;
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
	await s3().send(
		new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType })
	);
}

export async function deleteObject(key: string): Promise<void> {
	await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

// ponytail: 1h expiry — long enough for a page view, short enough that a leaked
// link goes stale. Bump if pages stay open longer than that.
// downloadName: filename the browser shows/saves instead of the opaque key.
export async function signedUrl(key: string, downloadName?: string): Promise<string> {
	let disposition: string | undefined = undefined;
	if (downloadName) {
		disposition = `inline; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
	}
	return getSignedUrl(
		s3(),
		new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ResponseContentDisposition: disposition }),
		{ expiresIn: 60 * 60 }
	);
}

// Browser-direct upload. The policy pins this exact key, content type and a size
// range, so S3 rejects the POST if the browser alters any of them. 5 min expiry.
export async function presignedPost(
	key: string,
	contentType: string,
	maxBytes: number
): Promise<{ url: string; fields: Record<string, string> }> {
	return createPresignedPost(s3(), {
		Bucket: required('S3_BUCKET'),
		Key: key,
		Fields: { 'Content-Type': contentType },
		Conditions: [
			['content-length-range', 1, maxBytes],
			['eq', '$Content-Type', contentType]
		],
		Expires: 5 * 60
	});
}

// null when the object doesn't exist.
export async function headObject(
	key: string
): Promise<{ sizeBytes: number; contentType: string | undefined } | null> {
	try {
		const result = await s3().send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
		return { sizeBytes: result.ContentLength ?? 0, contentType: result.ContentType };
	} catch (err) {
		if (err instanceof Error && err.name === 'NotFound') {
			return null;
		}
		throw err;
	}
}
