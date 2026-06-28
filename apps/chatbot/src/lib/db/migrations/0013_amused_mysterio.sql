ALTER TABLE "bot_config" ADD COLUMN "rag_k" integer;--> statement-breakpoint
ALTER TABLE "bot_config" ADD COLUMN "rag_min_score" numeric;--> statement-breakpoint
ALTER TABLE "bot_config" ADD COLUMN "media_min_score" numeric;--> statement-breakpoint
ALTER TABLE "bot_config" ADD COLUMN "temperature" numeric;--> statement-breakpoint
ALTER TABLE "bot_config" ADD COLUMN "max_attachments" integer;--> statement-breakpoint
ALTER TABLE "bot_config" ADD COLUMN "extra_instructions" text;