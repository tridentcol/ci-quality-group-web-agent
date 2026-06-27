ALTER TABLE "leads" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "agreed_price_cop" numeric;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "fulfillment" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "scheduled_for" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "wholesale_price2_cop" numeric;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "wholesale_threshold2" numeric;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "min_order" numeric;