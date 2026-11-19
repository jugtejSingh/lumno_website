ALTER TABLE "client" ADD COLUMN "invite_email_id" text;--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "invite_bounced_at" timestamp;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "bulk_imports" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "client_inviteEmailId_idx" ON "client" USING btree ("invite_email_id");