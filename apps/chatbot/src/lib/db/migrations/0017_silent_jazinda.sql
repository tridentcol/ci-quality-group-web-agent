ALTER TABLE "conversations" ADD COLUMN "summarized_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "memory_synced_at" timestamp with time zone;