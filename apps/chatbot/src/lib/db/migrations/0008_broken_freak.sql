ALTER TABLE "images" ADD COLUMN "type" text DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_qa" ADD COLUMN "image_id" uuid;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "image_id" uuid;--> statement-breakpoint
ALTER TABLE "knowledge_qa" ADD CONSTRAINT "knowledge_qa_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;