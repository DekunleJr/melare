-- Carry data from the first version of the site into the new structure.

-- Every existing product becomes a product with one variant.
INSERT INTO `product_variants` (`product_id`, `price_pence`, `stock`, `low_stock_threshold`)
SELECT `id`, `price_pence`, `stock`, `low_stock_threshold` FROM `products`;
--> statement-breakpoint
UPDATE `order_items` i JOIN `product_variants` v ON v.`product_id` = i.`product_id`
SET i.`variant_id` = v.`id`;
--> statement-breakpoint
-- Unfinished card checkouts can no longer be paid: return their stock and close them.
UPDATE `product_variants` v JOIN (
  SELECT i.`variant_id`, SUM(i.`quantity`) AS `quantity`
  FROM `order_items` i JOIN `orders` o ON o.`id` = i.`order_id`
  WHERE o.`status` = 'pending' AND o.`stock_reserved` = true
  GROUP BY i.`variant_id`
) held ON held.`variant_id` = v.`id`
SET v.`stock` = v.`stock` + held.`quantity`;
--> statement-breakpoint
UPDATE `orders` SET `status` = 'expired', `stock_reserved` = false WHERE `status` = 'pending';
--> statement-breakpoint
UPDATE `bookings` SET `status` = 'expired', `hold_expires_at` = NULL WHERE `status` = 'pending_payment';
--> statement-breakpoint
UPDATE `bookings` SET `blocked_from` = `starts_at`, `total_pence` = `price_pence`;
--> statement-breakpoint
-- Earlier card payments are kept as history. They are refunded in the old provider's dashboard.
INSERT INTO `payments` (`reference`, `user_id`, `order_id`, `method`, `status`, `amount_pence`, `order_pence`, `token_nonce`, `capture_id`, `note`, `completed_at`, `created_at`, `updated_at`)
SELECT CONCAT('PY-O', LPAD(`id`, 7, '0')), `user_id`, `id`, 'legacy', 'completed', `total_pence`, `total_pence`, MD5(CONCAT(RAND(), `id`)), `stripe_payment_intent_id`, 'Paid by card through Stripe', `paid_at`, `paid_at`, `paid_at`
FROM `orders` WHERE `paid_at` IS NOT NULL;
--> statement-breakpoint
INSERT INTO `payments` (`reference`, `user_id`, `booking_id`, `method`, `status`, `amount_pence`, `booking_pence`, `token_nonce`, `capture_id`, `note`, `completed_at`, `created_at`, `updated_at`)
SELECT CONCAT('PY-B', LPAD(`id`, 7, '0')), `user_id`, `id`, 'legacy', 'completed', `paid_pence`, `paid_pence`, MD5(CONCAT(RAND(), `id`)), `stripe_payment_intent_id`, 'Paid by card through Stripe', `updated_at`, `created_at`, `updated_at`
FROM `bookings` WHERE `paid_pence` > 0;
--> statement-breakpoint
INSERT INTO `refunds` (`payment_id`, `amount_pence`, `order_pence`, `note`, `created_at`)
SELECT p.`id`, o.`refunded_pence`, o.`refunded_pence`, 'Refunded through Stripe', o.`updated_at`
FROM `orders` o JOIN `payments` p ON p.`order_id` = o.`id` WHERE o.`refunded_pence` > 0;
--> statement-breakpoint
INSERT INTO `refunds` (`payment_id`, `amount_pence`, `booking_pence`, `note`, `created_at`)
SELECT p.`id`, b.`refunded_pence`, b.`refunded_pence`, 'Refunded through Stripe', b.`updated_at`
FROM `bookings` b JOIN `payments` p ON p.`booking_id` = b.`id` WHERE b.`refunded_pence` > 0;
--> statement-breakpoint
-- The single delivery fee becomes the first delivery method.
INSERT INTO `delivery_methods` (`name`, `description`, `price_pence`, `free_over_pence`)
SELECT 'Standard delivery', '',
  CAST(COALESCE((SELECT `value` FROM `settings` WHERE `key` = 'deliveryFeePence'), '495') AS UNSIGNED),
  CAST(COALESCE((SELECT `value` FROM `settings` WHERE `key` = 'freeDeliveryThresholdPence'), '5000') AS UNSIGNED);
--> statement-breakpoint
DELETE FROM `settings` WHERE `key` IN ('deliveryFeePence', 'freeDeliveryThresholdPence');
--> statement-breakpoint
-- New business name and wording, only where the original starting text is unchanged.
UPDATE `settings` SET `value` = 'MelareBeauty' WHERE `key` = 'businessName' AND `value` = 'Melare';
--> statement-breakpoint
UPDATE `settings` SET `value` = 'Hairdressing & hair products' WHERE `key` = 'tagline' AND `value` = 'Salon & beauty boutique';
--> statement-breakpoint
UPDATE `settings` SET `value` = 'Expert braiding, styling and colour in our salon or at your home, with the extensions and care products to match.' WHERE `key` = 'heroSubtitle' AND `value` = 'Expert hair, nail and skin treatments, plus the products our stylists trust, all in one calm space.';
--> statement-breakpoint
UPDATE `settings` SET `value` = 'Great hair, made easy.' WHERE `key` = 'heroTitle' AND `value` = 'Beauty, unhurried.';
--> statement-breakpoint
UPDATE `settings` SET `value` = 'MelareBeauty is a hairdressing and hair products business in the UK. Tell your story here: who you are, what you specialise in and what a visit feels like.' WHERE `key` = 'aboutText' AND `value` LIKE 'Melare is a salon built around time and care.%';
--> statement-breakpoint
INSERT IGNORE INTO `categories` (`name`, `slug`, `sort_order`) VALUES
  ('Hair Extensions', 'hair-extensions', 0),
  ('Hair Care Products', 'hair-care-products', 1),
  ('Hair Styling Tools', 'hair-styling-tools', 2);
--> statement-breakpoint
UPDATE `subscribers` SET `token_nonce` = MD5(CONCAT(RAND(), `id`));
