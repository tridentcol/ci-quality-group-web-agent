ALTER TABLE "knowledge_gaps" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "gaps_embedding_idx" ON "knowledge_gaps" USING hnsw ("embedding" vector_cosine_ops);