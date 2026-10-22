import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { client } from './users.schema';

// A number the client has entered but not yet verified. client.phone only ever holds a
// verified number: a correct code copies `phone` into client.phone and deletes this
// row (see phoneVerification.ts). Until then the client keeps their old verified
// number, or none, and reminders go wherever client.phone says.
export const clientPhoneVerification = pgTable('client_phone_verification', {
	clientId: text('client_id')
		.primaryKey()
		.references(() => client.id, { onDelete: 'cascade' }),
	phone: text('phone').notNull(),
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
