# TODO

- Add rate limiting (e.g. on auth/booking/payment endpoints)
- **[soon] Old-subscription cancel is best-effort on plan change.** In the
  `subscription.charged` webhook branch (`src/routes/webhooks/razorpay/+server.ts`
  ~line 129), `cancelSubscription(oldSubId)` is wrapped in `catch {}`. If it
  fails, the DB row no longer references `oldSubId` and nothing retries, so the
  old Razorpay sub can renew and charge the therapist again. Fix: log `oldSubId`
  loudly in the catch (greppable) and/or persist it for a reconcile sweep.
