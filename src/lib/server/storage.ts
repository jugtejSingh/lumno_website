import { env } from '$env/dynamic/private';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Private bucket for therapist uploads (pay QR images today). Objects are never
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
export async function signedUrl(key: string): Promise<string> {
	return getSignedUrl(s3(), new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
		expiresIn: 60 * 60
	});
}
