CREATE TABLE "knowledge_qa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bot_config" ADD COLUMN "qa_generation_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD COLUMN "qa_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_qa" ADD CONSTRAINT "knowledge_qa_source_id_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."knowledge_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "qa_embedding_idx" ON "knowledge_qa" USING hnsw ("embedding" vector_cosine_ops);