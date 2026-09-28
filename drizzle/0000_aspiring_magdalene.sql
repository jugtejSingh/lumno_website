CREATE TYPE "public"."client_status" AS ENUM('active', 'paused', 'left');--> statement-breakpoint
CREATE TYPE "public"."therapist_format" AS ENUM('remote', 'in_person', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."appointment_modality" AS ENUM('online', 'in_person');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('confirmed', 'cancelled', 'completed', 'rescheduled');--> statement-breakpoint
CREATE TYPE "public"."slot_modality" AS ENUM('online', 'in_person', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."client_note_visibility" AS ENUM('private', 'shared');--> statement-breakpoint
CREATE TYPE "public"."pack_status" AS ENUM('pending_payment', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."paid_via" AS ENUM('manual', 'razorpay');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('manual', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'paid');--> statement-breakpoint
CREATE TYPE "public"."razorpay_connection_status" AS ENUM('active', 'refresh_failed', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."razorpay_reconcile_exception_kind" AS ENUM('amount_mismatch', 'unresolved_order', 'already_paid', 'cancel_refund');--> statement-breakpoint
CREATE TYPE "public"."client_resource_kind" AS ENUM('file', 'link');--> statement-breakpoint
CREATE TYPE "public"."client_resource_tag" AS ENUM('prescription', 'assessment', 'reading', 'extra_information', 'medical_report', 'worksheet', 'letter', 'consent_form', 'other');--> statement-breakpoint
CREATE TYPE "public"."client_resource_uploader" AS ENUM('therapist', 'client');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"verification_email_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" text PRIMARY KEY NOT NULL,
	"therapist_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"date_of_birth" date,
	"gender" text,
	"city" text,
	"state" text,
	"country" text,
	"timezone" text,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"rate" integer,
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"invite_token" text,
	"invite_expires_at" timestamp,
	"deactivated_at" timestamp,
	"last_payment_reminder_at" timestamp with time zone,
	"last_session_at" timestamp with time zone,
	"rebook_reminder_stage" integer DEFAULT 0 NOT NULL,
	"last_rebook_reminder_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "therapist" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date_of_birth" date,
	"bio" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"photo_url" text,
	"slug" text NOT NULL,
	"location" text,
	"currency" text DEFAULT 'INR' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"organization_id" text,
	"years_experience" integer,
	"session_rate" integer,
	"session_format" "therapist_format",
	"welcome_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "therapist_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "therapist_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "appointment" (
	"id" text PRIMARY KEY NOT NULL,
	"therapist_id" text NOT NULL,
	"client_id" text,
	"custom_name" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"modality" "appointment_modality" NOT NULL,
	"status" "appointment_status" DEFAULT 'confirmed' NOT NULL,
	"rescheduled_from_id" text,
	"pack_id" text,
	"slot_id" text,
	"notes" text,
	"meet_link" text,
	"google_event_id" text,
	"reminder_24h_sent_at" timestamp with time zone,
	"reminder_1h_sent_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "appointment_client_xor_customName" CHECK (("appointment"."client_id" is not null)::int + ("appointment"."custom_name" is not null)::int = 1)
);
--> statement-breakpoint
CREATE TABLE "availability_date_override" (
	"therapist_id" text NOT NULL,
	"date" date NOT NULL,
	"max_sessions" integer,
	CONSTRAINT "availability_date_override_therapist_id_date_pk" PRIMARY KEY("therapist_id","date")
);
--> statement-breakpoint
CREATE TABLE "availability_slot" (
	"id" text PRIMARY KEY NOT NULL,
	"therapist_id" text NOT NULL,
	"weekday" integer,
	"override_date" date,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"modality" "slot_modality" NOT NULL,
	"reserved_client_id" text,
	CONSTRAINT "availabilitySlot_weekday_xor_overrideDate" CHECK (("availability_slot"."weekday" is not null)::int + ("availability_slot"."override_date" is not null)::int = 1),
	CONSTRAINT "availabilitySlot_weekday_range" CHECK ("availability_slot"."weekday" between 0 and 6),
	CONSTRAINT "availabilitySlot_end_after_start" CHECK ("availability_slot"."end_time" > "availability_slot"."start_time"),
	CONSTRAINT "availabilitySlot_reserved_template_only" CHECK ("availability_slot"."reserved_client_id" is null or "availability_slot"."weekday" is not null)
);
--> statement-breakpoint
CREATE TABLE "therapist_settings" (
	"therapist_id" text PRIMARY KEY NOT NULL,
	"max_upcoming_bookings_per_client" integer,
	"weekly_max_sessions" integer[],
	"weekly_holidays" boolean[],
	"require_zero_balance" boolean DEFAULT false NOT NULL,
	"send_meet_links" boolean DEFAULT true NOT NULL,
	"send_booking_emails" boolean DEFAULT true NOT NULL,
	"send_session_reminder_emails" boolean DEFAULT true NOT NULL,
	"send_payment_reminder_emails" boolean DEFAULT true NOT NULL,
	"send_rebook_reminder_emails" boolean DEFAULT true NOT NULL,
	"referral_visible" boolean DEFAULT false NOT NULL,
	"referral_show_years" boolean DEFAULT true NOT NULL,
	"referral_show_rate" boolean DEFAULT true NOT NULL,
	"client_field_headings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"booking_note" text,
	"min_booking_notice_hours" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_note" (
	"id" text PRIMARY KEY NOT NULL,
	"therapist_id" text NOT NULL,
	"client_id" text NOT NULL,
	"appointment_id" text,
	"visibility" "client_note_visibility" DEFAULT 'private' NOT NULL,
	"body" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"therapist_id" text NOT NULL,
	"client_id" text,
	"custom_name" text,
	"appointment_id" text,
	"pack_id" text,
	"amount" integer NOT NULL,
	"note" text,
	"status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"razorpay_order_id" text,
	"razorpay_order_created_at" timestamp,
	"razorpay_payment_id" text,
	"paid_via" "paid_via" DEFAULT 'manual' NOT NULL,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_razorpay_order_id_unique" UNIQUE("razorpay_order_id"),
	CONSTRAINT "payment_client_xor_customName" CHECK (("payment"."client_id" is not null)::int + ("payment"."custom_name" is not null)::int = 1)
);
--> statement-breakpoint
CREATE TABLE "payment_pack" (
	"id" text PRIMARY KEY NOT NULL,
	"therapist_id" text NOT NULL,
	"client_id" text NOT NULL,
	"session_count" integer NOT NULL,
	"status" "pack_status" DEFAULT 'pending_payment' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_settings" (
	"therapist_id" text PRIMARY KEY NOT NULL,
	"payment_mode" "payment_mode" DEFAULT 'manual' NOT NULL,
	"free_change_window_hours" integer DEFAULT 24 NOT NULL,
	"partial_change_window_hours" integer DEFAULT 8,
	"reschedule_charges_enabled" boolean DEFAULT true NOT NULL,
	"reschedule_free_change_window_hours" integer DEFAULT 24 NOT NULL,
	"reschedule_partial_change_window_hours" integer DEFAULT 8,
	"pay_qr_key" text,
	"pay_bank_details" text
);
--> statement-breakpoint
CREATE TABLE "razorpay_reconcile_exception" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"kind" "razorpay_reconcile_exception_kind" NOT NULL,
	"detail" text NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "therapist_razorpay_connection" (
	"therapist_id" text PRIMARY KEY NOT NULL,
	"razorpay_account_id" text NOT NULL,
	"mode" text NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"public_token" text NOT NULL,
	"access_expires_at" timestamp NOT NULL,
	"refresh_expires_at" timestamp NOT NULL,
	"status" "razorpay_connection_status" DEFAULT 'active' NOT NULL,
	"refresh_lock_until" timestamp,
	"refresh_failure_count" integer DEFAULT 0 NOT NULL,
	"last_refreshed_at" timestamp,
	"reconnect_email_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_therapist_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "razorpay_event" (
	"id" text PRIMARY KEY NOT NULL,
	"signature" text NOT NULL,
	"therapist_id" text,
	"plan" integer,
	"razorpay_plan_id" text,
	"razorpay_subscription_id" text,
	"razorpay_customer_id" text,
	"razorpay_payment_id" text,
	"amount" integer,
	"currency" text,
	"event" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_therapist_id" text NOT NULL,
	"referee_therapist_id" text NOT NULL,
	"qualified_at" timestamp,
	"redeemed_at" timestamp,
	"redeemed_payment_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"therapist_id" text,
	"organization_id" text,
	"plan" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"razorpay_subscription_id" text,
	"razorpay_customer_id" text,
	"razorpay_plan_id" text,
	"current_end" timestamp,
	"pending_sub_id" text,
	"pending_plan_id" text,
	"pending_since" timestamp,
	"cancel_scheduled" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_razorpay_subscription_id_unique" UNIQUE("razorpay_subscription_id"),
	CONSTRAINT "subscription_one_holder" CHECK (("subscription"."therapist_id" is not null)::int + ("subscription"."organization_id" is not null)::int = 1)
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"therapist_id" text NOT NULL,
	"year_month" text NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_therapist_id_year_month_pk" PRIMARY KEY("therapist_id","year_month")
);
--> statement-breakpoint
CREATE TABLE "client_resource" (
	"id" text PRIMARY KEY NOT NULL,
	"therapist_id" text NOT NULL,
	"client_id" text NOT NULL,
	"kind" "client_resource_kind" NOT NULL,
	"name" text NOT NULL,
	"tag" "client_resource_tag" NOT NULL,
	"s3_key" text,
	"content_type" text,
	"size_bytes" integer,
	"url" text,
	"uploaded_by" "client_resource_uploader" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_resource_s3_key_unique" UNIQUE("s3_key"),
	CONSTRAINT "client_resource_kind_payload" CHECK (("client_resource"."kind" = 'file' AND "client_resource"."s3_key" IS NOT NULL AND "client_resource"."url" IS NULL)
				OR ("client_resource"."kind" = 'link' AND "client_resource"."url" IS NOT NULL AND "client_resource"."s3_key" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapist" ADD CONSTRAINT "therapist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapist" ADD CONSTRAINT "therapist_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_pack_id_payment_pack_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."payment_pack"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_slot_id_availability_slot_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."availability_slot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_date_override" ADD CONSTRAINT "availability_date_override_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_slot" ADD CONSTRAINT "availability_slot_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_slot" ADD CONSTRAINT "availability_slot_reserved_client_id_client_id_fk" FOREIGN KEY ("reserved_client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_slot" ADD CONSTRAINT "availabilitySlot_override_fk" FOREIGN KEY ("therapist_id","override_date") REFERENCES "public"."availability_date_override"("therapist_id","date") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapist_settings" ADD CONSTRAINT "therapist_settings_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_note" ADD CONSTRAINT "client_note_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_note" ADD CONSTRAINT "client_note_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_note" ADD CONSTRAINT "client_note_appointment_id_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_appointment_id_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_pack_id_payment_pack_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."payment_pack"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_pack" ADD CONSTRAINT "payment_pack_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_pack" ADD CONSTRAINT "payment_pack_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_settings" ADD CONSTRAINT "payment_settings_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "razorpay_reconcile_exception" ADD CONSTRAINT "razorpay_reconcile_exception_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapist_razorpay_connection" ADD CONSTRAINT "therapist_razorpay_connection_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_owner_therapist_id_therapist_id_fk" FOREIGN KEY ("owner_therapist_id") REFERENCES "public"."therapist"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referrer_therapist_id_therapist_id_fk" FOREIGN KEY ("referrer_therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referee_therapist_id_therapist_id_fk" FOREIGN KEY ("referee_therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_resource" ADD CONSTRAINT "client_resource_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_resource" ADD CONSTRAINT "client_resource_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "client_therapistId_idx" ON "client" USING btree ("therapist_id");--> statement-breakpoint
CREATE INDEX "appointment_therapistId_startAt_idx" ON "appointment" USING btree ("therapist_id","start_at");--> statement-breakpoint
CREATE INDEX "appointment_clientId_startAt_idx" ON "appointment" USING btree ("client_id","start_at");--> statement-breakpoint
CREATE INDEX "appointment_slotId_idx" ON "appointment" USING btree ("slot_id");--> statement-breakpoint
CREATE INDEX "availabilitySlot_therapistId_idx" ON "availability_slot" USING btree ("therapist_id");--> statement-breakpoint
CREATE INDEX "availabilitySlot_reserved_idx" ON "availability_slot" USING btree ("reserved_client_id") WHERE "availability_slot"."reserved_client_id" is not null;--> statement-breakpoint
CREATE INDEX "clientNote_clientId_createdAt_idx" ON "client_note" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_clientId_idx" ON "payment" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "payment_appointmentId_idx" ON "payment" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "payment_packId_idx" ON "payment" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "paymentPack_clientId_idx" ON "payment_pack" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paymentPack_clientId_active_idx" ON "payment_pack" USING btree ("client_id") WHERE "payment_pack"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "razorpay_reconcile_exception_payment_kind_uidx" ON "razorpay_reconcile_exception" USING btree ("payment_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "razorpay_event_signature_uidx" ON "razorpay_event" USING btree ("signature");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_referrerTherapistId_uidx" ON "referral" USING btree ("referrer_therapist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_refereeTherapistId_uidx" ON "referral" USING btree ("referee_therapist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_therapistId_uidx" ON "subscription" USING btree ("therapist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_organizationId_uidx" ON "subscription" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "clientResource_clientId_createdAt_idx" ON "client_resource" USING btree ("client_id","created_at");