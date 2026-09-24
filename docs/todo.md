Would be cool to have a notes picture in picture with google meets so the person can write notes

Referrals per person for a month off

Payment to send email ads to people to book that havent in over a month

Research MHP and how they divide workload and how so maybe i can integrate it into lumno

Add in a vacation announcer

packs to purchase i guess need to be added

- Client emails: clients get no confirmation email for auto-booked weeks, only the usual 24h/1h reminders. You haven't confirmed that, so say if you want a confirmation email.

- Holiday warning: the warning for a holiday or day off over dates that already have bookings is still to do.
    1. Hybrid change. Saving the weekly template can change a reserved slot to hybrid, because the save only checks the fields it updates. The reservation stays on the row, but the cron skips hybrid slots, so the client silently
       stops being booked. Either the save should clear the reservation or block that change, or the cron should log it. setSlotReservation refuses hybrid, but the save doesn't.
    2. Freed weeks. A week that is cancelled, rescheduled or skipped for an overlap frees that slot for other clients to self-book. That's probably what you want, but I haven't checked how the client booking page treats reserved
       slots. For weeks that haven't been booked yet, the slot looks open to everyone.
    3. Hard-deleted appointments. The cron avoids double-booking by finding existing rows for the same client and start time. If a therapist hard-deletes an appointment instead of cancelling it, that week gets rebooked. I don't
       know whether the UI can hard-delete.
    4. Cron schedule. I didn't check the schedule in vercel.json. If the cron isn't daily, the 14-day window won't roll forward as intended.
    5. No test for the reserveSlot action. I tested setSlotReservation, but not the action itself, including its immediate booking. The modal and dropdown were also never opened in a browser.

  6. look at how the weekly slots operate, they seem to be buggy
