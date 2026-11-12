CREATE TYPE "public"."invoice_status" AS ENUM('issued', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invoice_tax_type_choice" AS ENUM('auto', 'cgst_sgst', 'igst', 'none');--> statement-breakpoint
CREATE TYPE "public"."invoice_tax_type" AS ENUM('cgst_sgst', 'igst', 'none');--> statement-breakpoint
CREATE TABLE "client_billing" (
	"client_id" text PRIMARY KEY NOT NULL,
	"company_name" text,
	"billing_email" text,
	"address" text,
	"gstin" text,
	"state_code" text,
	"tax_type" "invoice_tax_type_choice" DEFAULT 'auto' NOT NULL,
	"gst_rate" integer,
	"extra_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"auto_send" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"therapist_id" text NOT NULL,
	"payment_id" text,
	"client_id" text,
	"financial_year" text NOT NULL,
	"sequence" integer NOT NULL,
	"number" text NOT NULL,
	"issue_date" date NOT NULL,
	"status" "invoice_status" DEFAULT 'issued' NOT NULL,
	"tax_type" "invoice_tax_type" NOT NULL,
	"data" jsonb NOT NULL,
	"taxable_paise" integer NOT NULL,
	"tax_paise" integer NOT NULL,
	"total_paise" integer NOT NULL,
	"sent_to" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_payment_id_unique" UNIQUE("payment_id")
);
--> statement-breakpoint
CREATE TABLE "invoice_settings" (
	"therapist_id" text PRIMARY KEY NOT NULL,
	"legal_name" text,
	"address" text NOT NULL,
	"state_code" text NOT NULL,
	"gstin" text,
	"sac_code" text DEFAULT '9993' NOT NULL,
	"default_gst_rate" integer DEFAULT 18 NOT NULL,
	"number_prefix" text,
	"next_number" integer DEFAULT 1 NOT NULL,
	"next_number_year" text,
	"footer" text,
	"logo_key" text,
	"signature_key" text,
	"extra_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_billing" ADD CONSTRAINT "client_billing_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_settings" ADD CONSTRAINT "invoice_settings_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_therapistId_year_sequence_uidx" ON "invoice" USING btree ("therapist_id","financial_year","sequence");--> statement-breakpoint
CREATE INDEX "invoice_therapistId_issueDate_idx" ON "invoice" USING btree ("therapist_id","issue_date");--> statement-breakpoint
CREATE INDEX "invoice_clientId_idx" ON "invoice" USING btree ("client_id");