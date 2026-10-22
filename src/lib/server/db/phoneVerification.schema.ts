import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { client } from './users.schema';

// One row per client, kept off `client` so the OTP bookkeeping doesn't clutter it.
// `phone` is the number this row is about: a client counts as verified only while
// verifiedAt is set AND phone still equals client.phone. Changing client.phone
// therefore un-verifies them, and a code sent to the old number can't verify the
// new one, without setClientPhone having to know this table exists.
export const clientPhoneVerification = pgTable('client_phone_verification', {
	clientId: text('client_id')
		.primaryKey()
		.references(() => client.id, { onDelete: 'cascade' }),
	phone: text('phone').notNull(),
	verifiedAt: timestamp('verified_at', { withTimezone: true }),
	// SHA-256 of the current code; the code itself is never stored
	otpHash: text('otp_hash'),
	otpExpiresAt: timestamp('otp_expires_at', { withTimezone: true }),
	// wrong guesses since the last send; 5 locks the code until a new one is sent
	otpAttempts: integer('otp_attempts').notNull().default(0),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});
