CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" serial NOT NULL,
	"lead_id" uuid,
	"customer_name" text,
	"customer_contact" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"valid_days" integer DEFAULT 8 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;