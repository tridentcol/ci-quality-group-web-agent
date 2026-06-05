ALTER TABLE "knowledge_sources" ADD COLUMN "content" text;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD COLUMN "chunk_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();