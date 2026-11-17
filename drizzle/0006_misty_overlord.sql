CREATE TYPE "public"."refund_method" AS ENUM('razorpay', 'manual');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'processed', 'failed');--> statement-breakpoint
CREATE TABLE "payment_refund" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"therapist_id" text NOT NULL,
	"method" "refund_method" NOT NULL,
	"amount" integer NOT NULL,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"razorpay_payment_id" text,
	"razorpay_refund_id" text,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_refund_razorpay_refund_id_unique" UNIQUE("razorpay_refund_id"),
	CONSTRAINT "paymentRefund_amount_positive" CHECK ("payment_refund"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "payment_refund" ADD CONSTRAINT "payment_refund_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refund" ADD CONSTRAINT "payment_refund_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paymentRefund_paymentId_idx" ON "payment_refund" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paymentRefund_paymentId_live_uidx" ON "payment_refund" USING btree ("payment_id") WHERE "payment_refund"."status" in ('pending', 'processed');