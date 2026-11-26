CREATE TABLE `mobile_areas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`district` varchar(8) NOT NULL,
	`fee_pence` int NOT NULL DEFAULT 0,
	`travel_minutes` int NOT NULL DEFAULT 30,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `mobile_areas_id` PRIMARY KEY(`id`),
	CONSTRAINT `mobile_areas_district_idx` UNIQUE(`district`)
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`colour` varchar(60) NOT NULL DEFAULT '',
	`length` varchar(60) NOT NULL DEFAULT '',
	`texture` varchar(60) NOT NULL DEFAULT '',
	`size` varchar(60) NOT NULL DEFAULT '',
	`sku` varchar(60) NOT NULL DEFAULT '',
	`price_pence` int NOT NULL,
	`sale_price_pence` int NOT NULL DEFAULT 0,
	`stock` int NOT NULL DEFAULT 0,
	`low_stock_threshold` int NOT NULL DEFAULT 3,
	`image_path` varchar(255),
	`active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_variants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_addons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`service_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`price_pence` int NOT NULL,
	`extra_minutes` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `service_addons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`service_id` int NOT NULL,
	`path` varchar(255) NOT NULL,
	CONSTRAINT `service_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_addons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`booking_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`price_pence` int NOT NULL,
	`extra_minutes` int NOT NULL DEFAULT 0,
	CONSTRAINT `booking_addons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`booking_id` int NOT NULL,
	`file_name` varchar(60) NOT NULL,
	CONSTRAINT `booking_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_methods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` varchar(200) NOT NULL DEFAULT '',
	`price_pence` int NOT NULL DEFAULT 0,
	`free_over_pence` int NOT NULL DEFAULT 0,
	`postcodes` varchar(500) NOT NULL DEFAULT '',
	`active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `delivery_methods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `discount_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(40) NOT NULL,
	`type` enum('percent','fixed') NOT NULL,
	`value` int NOT NULL,
	`applies_to` enum('all','products','services') NOT NULL DEFAULT 'all',
	`min_spend_pence` int NOT NULL DEFAULT 0,
	`starts_at` datetime(3),
	`ends_at` datetime(3),
	`max_uses` int NOT NULL DEFAULT 0,
	`used_count` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `discount_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `discount_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(20) NOT NULL,
	`user_id` varchar(36),
	`order_id` int,
	`booking_id` int,
	`purpose` enum('checkout','balance') NOT NULL DEFAULT 'checkout',
	`method` enum('paypal','cash','card_in_salon','bank_transfer','legacy') NOT NULL DEFAULT 'paypal',
	`status` enum('pending','capturing','processing','completed','failed','cancelled','expired') NOT NULL DEFAULT 'pending',
	`amount_pence` int NOT NULL,
	`order_pence` int NOT NULL DEFAULT 0,
	`booking_pence` int NOT NULL DEFAULT 0,
	`token_nonce` varchar(32) NOT NULL,
	`paypal_order_id` varchar(64),
	`capture_id` varchar(64),
	`note` varchar(255) NOT NULL DEFAULT '',
	`expires_at` datetime(3),
	`completed_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payment_id` int NOT NULL,
	`amount_pence` int NOT NULL,
	`order_pence` int NOT NULL DEFAULT 0,
	`booking_pence` int NOT NULL DEFAULT 0,
	`provider_refund_id` varchar(64),
	`note` varchar(255) NOT NULL DEFAULT '',
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `refunds_id` PRIMARY KEY(`id`),
	CONSTRAINT `refunds_provider_refund_id_unique` UNIQUE(`provider_refund_id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` varchar(255) NOT NULL,
	`type` varchar(100) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `webhook_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_pages` (
	`slug` varchar(60) NOT NULL,
	`title` varchar(150) NOT NULL,
	`body` mediumtext NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `content_pages_slug` PRIMARY KEY(`slug`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`slug` varchar(220) NOT NULL,
	`excerpt` varchar(400) NOT NULL DEFAULT '',
	`body` mediumtext NOT NULL,
	`cover_image` varchar(255),
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`published_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `posts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `saved_carts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`name` varchar(120) NOT NULL DEFAULT '',
	`items` text NOT NULL,
	`token_nonce` varchar(32) NOT NULL,
	`reminded_at` datetime(3),
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `saved_carts_id` PRIMARY KEY(`id`),
	CONSTRAINT `saved_carts_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `products` MODIFY COLUMN `price_pence` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `bookings` MODIFY COLUMN `status` enum('requested','pending_payment','confirmed','completed','cancelled','declined','no_show','expired') NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `fulfilment` enum('delivery','pickup','appointment') NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `deposit_type` enum('fixed','percent') DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `deposit_percent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `location_mode` enum('salon','mobile','both') DEFAULT 'salon' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `requires_approval` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `suggested_category_id` int;--> statement-breakpoint
ALTER TABLE `staff` ADD `offers_mobile` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `blocked_from` datetime(3);--> statement-breakpoint
ALTER TABLE `bookings` ADD `location_type` enum('salon','mobile') DEFAULT 'salon' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `address_line1` varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `address_line2` varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `city` varchar(100) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `postcode` varchar(20) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `travel_minutes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `addons_pence` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `travel_fee_pence` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `discount_pence` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `total_pence` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `discount_code_id` int;--> statement-breakpoint
ALTER TABLE `bookings` ADD `discount_code` varchar(40) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `variant_id` int;--> statement-breakpoint
ALTER TABLE `order_items` ADD `variant_label` varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `booking_id` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_method_name` varchar(100) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_code_id` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_code` varchar(40) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscribers` ADD `token_nonce` varchar(32) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_addons` ADD CONSTRAINT `service_addons_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_images` ADD CONSTRAINT `service_images_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_addons` ADD CONSTRAINT `booking_addons_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_images` ADD CONSTRAINT `booking_images_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_payment_id_payments_id_fk` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `product_variants_product_idx` ON `product_variants` (`product_id`);--> statement-breakpoint
CREATE INDEX `service_addons_service_idx` ON `service_addons` (`service_id`);--> statement-breakpoint
CREATE INDEX `service_images_service_idx` ON `service_images` (`service_id`);--> statement-breakpoint
CREATE INDEX `booking_addons_booking_idx` ON `booking_addons` (`booking_id`);--> statement-breakpoint
CREATE INDEX `booking_images_booking_idx` ON `booking_images` (`booking_id`);--> statement-breakpoint
CREATE INDEX `payments_order_idx` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `payments_booking_idx` ON `payments` (`booking_id`);--> statement-breakpoint
CREATE INDEX `payments_user_idx` ON `payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `payments_paypal_idx` ON `payments` (`paypal_order_id`);--> statement-breakpoint
CREATE INDEX `payments_capture_idx` ON `payments` (`capture_id`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `refunds_payment_idx` ON `refunds` (`payment_id`);--> statement-breakpoint
CREATE INDEX `posts_status_idx` ON `posts` (`status`,`published_at`);--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_suggested_category_id_categories_id_fk` FOREIGN KEY (`suggested_category_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_discount_code_id_discount_codes_id_fk` FOREIGN KEY (`discount_code_id`) REFERENCES `discount_codes`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_discount_code_id_discount_codes_id_fk` FOREIGN KEY (`discount_code_id`) REFERENCES `discount_codes`(`id`) ON DELETE set null ON UPDATE no action;