CREATE TABLE `account` (
	`id` varchar(36) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`provider_id` varchar(255) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` datetime(3),
	`refresh_token_expires_at` datetime(3),
	`scope` text,
	`password` text,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `account_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` varchar(36) NOT NULL,
	`phone` varchar(40) NOT NULL DEFAULT '',
	`address_line1` varchar(200) NOT NULL DEFAULT '',
	`address_line2` varchar(200) NOT NULL DEFAULT '',
	`city` varchar(100) NOT NULL DEFAULT '',
	`postcode` varchar(20) NOT NULL DEFAULT '',
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `profiles_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(36) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	`ip_address` varchar(64),
	`user_agent` text,
	`user_id` varchar(36) NOT NULL,
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` text,
	`role` enum('customer','admin') NOT NULL DEFAULT 'customer',
	`disabled` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(36) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`path` varchar(255) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category_id` int,
	`name` varchar(150) NOT NULL,
	`slug` varchar(170) NOT NULL,
	`description` text NOT NULL,
	`price_pence` int NOT NULL,
	`stock` int NOT NULL DEFAULT 0,
	`low_stock_threshold` int NOT NULL DEFAULT 3,
	`featured` boolean NOT NULL DEFAULT false,
	`status` enum('active','draft','archived') NOT NULL DEFAULT 'active',
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(150) NOT NULL,
	`slug` varchar(170) NOT NULL,
	`category` varchar(100) NOT NULL DEFAULT 'General',
	`description` text NOT NULL,
	`duration_minutes` int NOT NULL,
	`buffer_minutes` int NOT NULL DEFAULT 0,
	`price_pence` int NOT NULL,
	`payment_mode` enum('pay_at_salon','deposit','full') NOT NULL DEFAULT 'pay_at_salon',
	`deposit_pence` int NOT NULL DEFAULT 0,
	`image_path` varchar(255),
	`featured` boolean NOT NULL DEFAULT false,
	`status` enum('active','draft','archived') NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `services_id` PRIMARY KEY(`id`),
	CONSTRAINT `services_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`title` varchar(120) NOT NULL DEFAULT '',
	`bio` text NOT NULL,
	`image_path` varchar(255),
	`active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `staff_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_services` (
	`staff_id` int NOT NULL,
	`service_id` int NOT NULL,
	CONSTRAINT `staff_services_staff_id_service_id_pk` PRIMARY KEY(`staff_id`,`service_id`)
);
--> statement-breakpoint
CREATE TABLE `time_off` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int NOT NULL,
	`starts_at` datetime(3) NOT NULL,
	`ends_at` datetime(3) NOT NULL,
	`reason` varchar(200) NOT NULL DEFAULT '',
	CONSTRAINT `time_off_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `working_hours` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int NOT NULL,
	`weekday` int NOT NULL,
	`start_minute` int NOT NULL,
	`end_minute` int NOT NULL,
	CONSTRAINT `working_hours_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(20) NOT NULL,
	`user_id` varchar(36),
	`service_id` int NOT NULL,
	`staff_id` int NOT NULL,
	`service_name` varchar(150) NOT NULL,
	`staff_name` varchar(120) NOT NULL,
	`starts_at` datetime(3) NOT NULL,
	`ends_at` datetime(3) NOT NULL,
	`blocked_until` datetime(3) NOT NULL,
	`price_pence` int NOT NULL,
	`payment_mode` enum('pay_at_salon','deposit','full') NOT NULL,
	`amount_due_pence` int NOT NULL DEFAULT 0,
	`paid_pence` int NOT NULL DEFAULT 0,
	`refunded_pence` int NOT NULL DEFAULT 0,
	`status` enum('pending_payment','confirmed','completed','cancelled','no_show','expired') NOT NULL,
	`payment_status` enum('not_required','unpaid','paid','partially_refunded','refunded') NOT NULL,
	`customer_name` varchar(120) NOT NULL,
	`customer_email` varchar(255) NOT NULL,
	`customer_phone` varchar(40) NOT NULL,
	`notes` text NOT NULL,
	`token_nonce` varchar(32) NOT NULL,
	`stripe_session_id` varchar(255),
	`stripe_payment_intent_id` varchar(255),
	`hold_expires_at` datetime(3),
	`reminder_sent_at` datetime(3),
	`cancelled_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookings_reference_unique` UNIQUE(`reference`),
	CONSTRAINT `bookings_stripe_session_id_unique` UNIQUE(`stripe_session_id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`product_id` int,
	`name` varchar(150) NOT NULL,
	`unit_price_pence` int NOT NULL,
	`quantity` int NOT NULL,
	`image_path` varchar(255),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(20) NOT NULL,
	`user_id` varchar(36),
	`status` enum('pending','paid','processing','ready_for_pickup','shipped','completed','cancelled','expired','refunded') NOT NULL DEFAULT 'pending',
	`fulfilment` enum('delivery','pickup') NOT NULL,
	`customer_name` varchar(120) NOT NULL,
	`customer_email` varchar(255) NOT NULL,
	`customer_phone` varchar(40) NOT NULL,
	`address_line1` varchar(200) NOT NULL DEFAULT '',
	`address_line2` varchar(200) NOT NULL DEFAULT '',
	`city` varchar(100) NOT NULL DEFAULT '',
	`postcode` varchar(20) NOT NULL DEFAULT '',
	`notes` text NOT NULL,
	`tracking_info` varchar(255) NOT NULL DEFAULT '',
	`subtotal_pence` int NOT NULL,
	`delivery_pence` int NOT NULL DEFAULT 0,
	`discount_pence` int NOT NULL DEFAULT 0,
	`total_pence` int NOT NULL,
	`refunded_pence` int NOT NULL DEFAULT 0,
	`stock_reserved` boolean NOT NULL DEFAULT true,
	`token_nonce` varchar(32) NOT NULL,
	`stripe_session_id` varchar(255),
	`stripe_payment_intent_id` varchar(255),
	`expires_at` datetime(3),
	`paid_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_number_unique` UNIQUE(`number`),
	CONSTRAINT `orders_stripe_session_id_unique` UNIQUE(`stripe_session_id`)
);
--> statement-breakpoint
CREATE TABLE `stripe_events` (
	`id` varchar(255) NOT NULL,
	`type` varchar(100) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `stripe_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(40) NOT NULL DEFAULT '',
	`subject` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`status` enum('new','read','archived') NOT NULL DEFAULT 'new',
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `contact_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`to_address` varchar(255) NOT NULL,
	`reply_to` varchar(255),
	`subject` varchar(255) NOT NULL,
	`html` mediumtext NOT NULL,
	`text` mediumtext NOT NULL,
	`ics` text,
	`kind` varchar(60) NOT NULL,
	`status` enum('queued','sent','logged','failed') NOT NULL DEFAULT 'queued',
	`error` text,
	`created_at` datetime(3) NOT NULL,
	`sent_at` datetime(3),
	CONSTRAINT `email_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `faqs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`question` varchar(300) NOT NULL,
	`answer` text NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`published` boolean NOT NULL DEFAULT true,
	CONSTRAINT `faqs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gallery_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`path` varchar(255) NOT NULL,
	`caption` varchar(200) NOT NULL DEFAULT '',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `gallery_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36),
	`author_name` varchar(120) NOT NULL,
	`product_id` int,
	`service_id` int,
	`order_id` int,
	`booking_id` int,
	`rating` int NOT NULL,
	`comment` text NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `reviews_order_product_idx` UNIQUE(`order_id`,`product_id`),
	CONSTRAINT `reviews_booking_idx` UNIQUE(`booking_id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `subscribers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `subscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscribers_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_services` ADD CONSTRAINT `staff_services_staff_id_staff_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_services` ADD CONSTRAINT `staff_services_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `time_off` ADD CONSTRAINT `time_off_staff_id_staff_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `working_hours` ADD CONSTRAINT `working_hours_staff_id_staff_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_staff_id_staff_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `product_images_product_idx` ON `product_images` (`product_id`);--> statement-breakpoint
CREATE INDEX `products_status_idx` ON `products` (`status`);--> statement-breakpoint
CREATE INDEX `time_off_staff_idx` ON `time_off` (`staff_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `working_hours_staff_idx` ON `working_hours` (`staff_id`,`weekday`);--> statement-breakpoint
CREATE INDEX `bookings_staff_time_idx` ON `bookings` (`staff_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `bookings_start_idx` ON `bookings` (`starts_at`);--> statement-breakpoint
CREATE INDEX `bookings_user_idx` ON `bookings` (`user_id`);--> statement-breakpoint
CREATE INDEX `bookings_email_idx` ON `bookings` (`customer_email`);--> statement-breakpoint
CREATE INDEX `bookings_intent_idx` ON `bookings` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `orders_email_idx` ON `orders` (`customer_email`);--> statement-breakpoint
CREATE INDEX `orders_intent_idx` ON `orders` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE INDEX `email_log_created_idx` ON `email_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `reviews_status_idx` ON `reviews` (`status`);