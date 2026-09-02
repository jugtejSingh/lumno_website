import { vi } from 'vitest';
import dotenv from 'dotenv';

// Stub the external-IO modules for every integration test — Resend, Google
// Calendar, and the booking-email composer. The DB behaviour around them is
// what's under test, not the network calls.
vi.mock('$lib/server/email', () => ({
	sendEmail: vi.fn(async () => {})
}));
vi.mock('$lib/server/googleCalendar', () => ({
	createMeetEvent: vi.fn(async () => null),
	patchMeetEventTime: vi.fn(async () => {}),
	deleteMeetEvent: vi.fn(async () => {})
}));
vi.mock('$lib/server/bookingEmails', () => ({
	sendAppointmentEmail: vi.fn(async () => {})
}));

// Per-worker: load .env and force every $lib/server/db import onto the test DB
// before any test module (and its db singleton) is imported.
dotenv.config({ quiet: true });

if (!process.env.DATABASE_URL_TEST) {
	throw new Error('DATABASE_URL_TEST is not set — add it to .env');
}
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

// keep the real integrations inert if any module reads these on import
process.env.RESEND_API_KEY ??= 'test';
process.env.RAZORPAY_KEY_ID ??= 'test';
process.env.RAZORPAY_KEY_SECRET ??= 'test';
