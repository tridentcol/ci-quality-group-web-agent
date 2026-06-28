CREATE INDEX "conversations_last_msg_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "chunks_source_idx" ON "knowledge_chunks" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "gaps_conversation_idx" ON "knowledge_gaps" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "qa_source_idx" ON "knowledge_qa" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "leads_conversation_idx" ON "leads" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "leads_created_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "messages_conv_created_idx" ON "messages" USING btree ("conversation_id","created_at");