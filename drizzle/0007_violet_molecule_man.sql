CREATE TABLE "intake_form" (
	"id" text PRIMARY KEY NOT NULL,
	"therapist_id" text NOT NULL,
	"title" text NOT NULL,
	"intro" text,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"share_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "intake_form_therapist_id_unique" UNIQUE("therapist_id"),
	CONSTRAINT "intake_form_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "intake_response" (
	"id" text PRIMARY KEY NOT NULL,
	"therapist_id" text NOT NULL,
	"intake_form_id" text NOT NULL,
	"questions_snapshot" jsonb NOT NULL,
	"answers" jsonb NOT NULL,
	"email" text,
	"name" text,
	"client_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intake_form" ADD CONSTRAINT "intake_form_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_response" ADD CONSTRAINT "intake_response_therapist_id_therapist_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_response" ADD CONSTRAINT "intake_response_intake_form_id_intake_form_id_fk" FOREIGN KEY ("intake_form_id") REFERENCES "public"."intake_form"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_response" ADD CONSTRAINT "intake_response_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intake_response_therapist_id_created_at_idx" ON "intake_response" USING btree ("therapist_id","created_at");--> statement-breakpoint
CREATE INDEX "intake_response_form_id_idx" ON "intake_response" USING btree ("intake_form_id");--> statement-breakpoint
CREATE INDEX "intake_response_client_id_idx" ON "intake_response" USING btree ("client_id");