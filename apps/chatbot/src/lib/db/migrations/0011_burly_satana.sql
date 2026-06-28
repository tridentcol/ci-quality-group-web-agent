ALTER TABLE "bot_config" ADD COLUMN "location_name" text;--> statement-breakpoint
ALTER TABLE "bot_config" ADD COLUMN "location_address" text;--> statement-breakpoint
ALTER TABLE "bot_config" ADD COLUMN "location_lat" numeric;--> statement-breakpoint
ALTER TABLE "bot_config" ADD COLUMN "location_lng" numeric;--> statement-breakpoint
ALTER TABLE "bot_config" ADD COLUMN "location_maps_url" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "payment_method" text;