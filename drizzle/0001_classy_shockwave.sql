ALTER TABLE "therapist_settings" ADD COLUMN "outreach_token" text;--> statement-breakpoint
ALTER TABLE "therapist_settings" ADD COLUMN "outreach_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "therapist_settings" ADD CONSTRAINT "therapist_settings_outreach_token_unique" UNIQUE("outreach_token");