ALTER TABLE "bot_config" ADD COLUMN "notifications" jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "ref" serial NOT NULL;