import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '$env/dynamic/private';

// Global per-IP request limit, backed by the Upstash Redis instance we already
// use elsewhere. Sliding window so a burst at the boundary of two fixed
// windows can't double the effective rate.
export const ratelimit = new Ratelimit({
	redis: new Redis({
		url: env.UPSTASH_REDIS_REST_URL,
		token: env.UPSTASH_REDIS_REST_TOKEN
	}),
	limiter: Ratelimit.slidingWindow(30, '60 s'),
	analytics: true,
	prefix: 'ratelimit'
});
