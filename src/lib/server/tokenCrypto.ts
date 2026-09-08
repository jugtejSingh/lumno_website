import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

// AES-256-GCM encryption for the Razorpay OAuth token vault.
// Blob format: "<iv b64>.<tag b64>.<ciphertext b64>". Never store plaintext.
//
// ponytail: single static key from env. Per-row KMS-wrapped data keys
// (docs/razorpay-oauth-system-design.md §4.3) when a DB dump is a real threat
// and KMS call cost is acceptable.

function key(): Buffer {
	const raw = env.TOKEN_ENC_KEY;
	if (!raw) {
		throw new Error('TOKEN_ENC_KEY not set');
	}
	const buf = Buffer.from(raw, 'base64');
	if (buf.length !== 32) {
		throw new Error('TOKEN_ENC_KEY must decode to 32 bytes (base64-encoded 256-bit key)');
	}
	return buf;
}

export function encryptToken(plain: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key(), iv);
	const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decryptToken(blob: string): string {
	const parts = blob.split('.');
	if (parts.length !== 3) {
		throw new Error('malformed token blob');
	}
	const [ivB64, tagB64, ciphertextB64] = parts;
	const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
	decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
	const plain = Buffer.concat([
		decipher.update(Buffer.from(ciphertextB64, 'base64')),
		decipher.final()
	]);
	return plain.toString('utf8');
}
