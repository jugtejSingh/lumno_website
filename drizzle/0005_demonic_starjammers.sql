CREATE TABLE "client_phone_verification" (
	"client_id" text PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"verified_at" timestamp with time zone,
	"otp_hash" text,
	"otp_expires_at" timestamp with time zone,
	"otp_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_phone_verification" ADD CONSTRAINT "client_phone_verification_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;