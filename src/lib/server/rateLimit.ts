import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '$env/dynamic/private';

const redis = new Redis({
	url: env.UPSTASH_REDIS_REST_URL,
	token: env.UPSTASH_REDIS_REST_TOKEN
});

// Global per-IP request limit, backed by the Upstash Redis instance we already
// use elsewhere. Sliding window so a burst at the boundary of two fixed
// windows can't double the effective rate.
export const ratelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(30, '60 s'),
	analytics: true,
	prefix: 'ratelimit'
});

// One feedback/issue email per IP per day — it lands in a human inbox.
export const feedbackRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.fixedWindow(1, '1 d'),
	prefix: 'ratelimit:feedback'
});

// WhatsApp verification codes, keyed by client id. Each send costs a Meta message and
// lands on someone's phone; this also bounds guessing, since every new code gets only
// 5 tries (see phoneVerification.ts).
export const phoneOtpRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.fixedWindow(5, '1 h'),
	prefix: 'ratelimit:phone-otp'
});

// Same codes, keyed by the hashed destination number. The per-client limit alone still
// lets someone send a stranger 5 codes an hour, every hour; this caps any one number.
export const phoneOtpNumberRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.fixedWindow(3, '1 d'),
	prefix: 'ratelimit:phone-otp-number'
});
