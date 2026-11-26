DROP TABLE `stripe_events`;--> statement-breakpoint
ALTER TABLE `bookings` DROP INDEX `bookings_stripe_session_id_unique`;--> statement-breakpoint
ALTER TABLE `orders` DROP INDEX `orders_stripe_session_id_unique`;--> statement-breakpoint
DROP INDEX `bookings_intent_idx` ON `bookings`;--> statement-breakpoint
DROP INDEX `orders_intent_idx` ON `orders`;--> statement-breakpoint
ALTER TABLE `bookings` MODIFY COLUMN `blocked_from` datetime(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `price_pence`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `stock`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `low_stock_threshold`;--> statement-breakpoint
ALTER TABLE `bookings` DROP COLUMN `stripe_session_id`;--> statement-breakpoint
ALTER TABLE `bookings` DROP COLUMN `stripe_payment_intent_id`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `stripe_session_id`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `stripe_payment_intent_id`;