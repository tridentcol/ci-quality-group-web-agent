ALTER TABLE "leads" ALTER COLUMN "conversation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "test" boolean DEFAULT false NOT NULL;