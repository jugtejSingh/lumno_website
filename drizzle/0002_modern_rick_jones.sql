ALTER TABLE "availability_slot" ADD COLUMN "reserved_every_weeks" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "therapist_settings" ADD COLUMN "booking_window_days" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_slot" ADD CONSTRAINT "availabilitySlot_reserved_every_weeks" CHECK ("availability_slot"."reserved_every_weeks" in (1, 2, 4));