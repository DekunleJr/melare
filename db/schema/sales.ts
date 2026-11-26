import { boolean, index, int, mysqlEnum, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { user } from "./auth";
import { paymentModes, productVariants, products, services, staff } from "./catalog";
import { createdAt, updatedAt, utc } from "./columns";

export const bookingStatuses = [
  "requested",
  "pending_payment",
  "confirmed",
  "completed",
  "cancelled",
  "declined",
  "no_show",
  "expired",
] as const;

export const bookingPaymentStatuses = [
  "not_required",
  "unpaid",
  "paid",
  "partially_refunded",
  "refunded",
] as const;

export const orderStatuses = [
  "pending",
  "paid",
  "processing",
  "ready_for_pickup",
  "shipped",
  "completed",
  "cancelled",
  "expired",
  "refunded",
] as const;

/** "appointment": handed over at (or brought to) a booked appointment */
export const fulfilmentMethods = ["delivery", "pickup", "appointment"] as const;
export const appointmentLocations = ["salon", "mobile"] as const;
export const discountTypes = ["percent", "fixed"] as const;
export const discountScopes = ["all", "products", "services"] as const;
export const paymentMethods = ["paypal", "cash", "card_in_salon", "bank_transfer", "legacy"] as const;
export const paymentStatuses = [
  "pending",
  "capturing",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "expired",
] as const;

export const discountCodes = mysqlTable("discount_codes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  type: mysqlEnum("type", discountTypes).notNull(),
  /** Percent (1-100) or pence */
  value: int("value").notNull(),
  appliesTo: mysqlEnum("applies_to", discountScopes).notNull().default("all"),
  minSpendPence: int("min_spend_pence").notNull().default(0),
  startsAt: utc("starts_at"),
  endsAt: utc("ends_at"),
  /** 0 means unlimited */
  maxUses: int("max_uses").notNull().default(0),
  usedCount: int("used_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const deliveryMethods = mysqlTable("delivery_methods", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: varchar("description", { length: 200 }).notNull().default(""),
  pricePence: int("price_pence").notNull().default(0),
  /** 0 means never free */
  freeOverPence: int("free_over_pence").notNull().default(0),
  /** Comma separated postcode districts or areas. Empty means everywhere. */
  postcodes: varchar("postcodes", { length: 500 }).notNull().default(""),
  active: boolean("active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
});

export const bookings = mysqlTable(
  "bookings",
  {
    id: int("id").autoincrement().primaryKey(),
    reference: varchar("reference", { length: 20 }).notNull().unique(),
    /** Empty for guest bookings */
    userId: varchar("user_id", { length: 36 }).references(() => user.id, { onDelete: "set null" }),
    serviceId: int("service_id")
      .notNull()
      .references(() => services.id),
    staffId: int("staff_id")
      .notNull()
      .references(() => staff.id),
    serviceName: varchar("service_name", { length: 150 }).notNull(),
    staffName: varchar("staff_name", { length: 120 }).notNull(),
    startsAt: utc("starts_at").notNull(),
    endsAt: utc("ends_at").notNull(),
    /** The staff member is busy from here (includes travel to a mobile visit)... */
    blockedFrom: utc("blocked_from").notNull(),
    /** ...until here (clean-up buffer and travel back) */
    blockedUntil: utc("blocked_until").notNull(),
    locationType: mysqlEnum("location_type", appointmentLocations).notNull().default("salon"),
    addressLine1: varchar("address_line1", { length: 200 }).notNull().default(""),
    addressLine2: varchar("address_line2", { length: 200 }).notNull().default(""),
    city: varchar("city", { length: 100 }).notNull().default(""),
    postcode: varchar("postcode", { length: 20 }).notNull().default(""),
    travelMinutes: int("travel_minutes").notNull().default(0),
    /** Base service price */
    pricePence: int("price_pence").notNull(),
    addonsPence: int("addons_pence").notNull().default(0),
    travelFeePence: int("travel_fee_pence").notNull().default(0),
    discountPence: int("discount_pence").notNull().default(0),
    /** price + add-ons + travel - discount */
    totalPence: int("total_pence").notNull().default(0),
    discountCodeId: int("discount_code_id").references(() => discountCodes.id, {
      onDelete: "set null",
    }),
    discountCode: varchar("discount_code", { length: 40 }).notNull().default(""),
    paymentMode: mysqlEnum("payment_mode", paymentModes).notNull(),
    /** Amount of the appointment to collect online when booking */
    amountDuePence: int("amount_due_pence").notNull().default(0),
    /** Kept in step with the payments and refunds tables */
    paidPence: int("paid_pence").notNull().default(0),
    refundedPence: int("refunded_pence").notNull().default(0),
    status: mysqlEnum("status", bookingStatuses).notNull(),
    paymentStatus: mysqlEnum("payment_status", bookingPaymentStatuses).notNull(),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 40 }).notNull(),
    notes: text("notes").notNull(),
    /** Random value mixed into the private manage-link signature */
    tokenNonce: varchar("token_nonce", { length: 32 }).notNull(),
    /** When an unpaid or unapproved booking gives up its slot */
    holdExpiresAt: utc("hold_expires_at"),
    reminderSentAt: utc("reminder_sent_at"),
    cancelledAt: utc("cancelled_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("bookings_staff_time_idx").on(t.staffId, t.startsAt),
    index("bookings_start_idx").on(t.startsAt),
    index("bookings_user_idx").on(t.userId),
    index("bookings_email_idx").on(t.customerEmail),
  ],
);

export const bookingAddons = mysqlTable(
  "booking_addons",
  {
    id: int("id").autoincrement().primaryKey(),
    bookingId: int("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    pricePence: int("price_pence").notNull(),
    extraMinutes: int("extra_minutes").notNull().default(0),
  },
  (t) => [index("booking_addons_booking_idx").on(t.bookingId)],
);

/** Customers' reference photographs. Stored privately. */
export const bookingImages = mysqlTable(
  "booking_images",
  {
    id: int("id").autoincrement().primaryKey(),
    bookingId: int("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 60 }).notNull(),
  },
  (t) => [index("booking_images_booking_idx").on(t.bookingId)],
);

export const orders = mysqlTable(
  "orders",
  {
    id: int("id").autoincrement().primaryKey(),
    number: varchar("number", { length: 20 }).notNull().unique(),
    /** Empty for guest orders */
    userId: varchar("user_id", { length: 36 }).references(() => user.id, { onDelete: "set null" }),
    /** Set when the products were bought together with an appointment */
    bookingId: int("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    status: mysqlEnum("status", orderStatuses).notNull().default("pending"),
    fulfilment: mysqlEnum("fulfilment", fulfilmentMethods).notNull(),
    deliveryMethodName: varchar("delivery_method_name", { length: 100 }).notNull().default(""),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 40 }).notNull(),
    addressLine1: varchar("address_line1", { length: 200 }).notNull().default(""),
    addressLine2: varchar("address_line2", { length: 200 }).notNull().default(""),
    city: varchar("city", { length: 100 }).notNull().default(""),
    postcode: varchar("postcode", { length: 20 }).notNull().default(""),
    notes: text("notes").notNull(),
    trackingInfo: varchar("tracking_info", { length: 255 }).notNull().default(""),
    subtotalPence: int("subtotal_pence").notNull(),
    deliveryPence: int("delivery_pence").notNull().default(0),
    discountPence: int("discount_pence").notNull().default(0),
    discountCodeId: int("discount_code_id").references(() => discountCodes.id, {
      onDelete: "set null",
    }),
    discountCode: varchar("discount_code", { length: 40 }).notNull().default(""),
    totalPence: int("total_pence").notNull(),
    refundedPence: int("refunded_pence").notNull().default(0),
    /** True while the items are deducted from stock */
    stockReserved: boolean("stock_reserved").notNull().default(true),
    tokenNonce: varchar("token_nonce", { length: 32 }).notNull(),
    expiresAt: utc("expires_at"),
    paidAt: utc("paid_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("orders_status_idx").on(t.status),
    index("orders_user_idx").on(t.userId),
    index("orders_email_idx").on(t.customerEmail),
  ],
);

export const orderItems = mysqlTable(
  "order_items",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: int("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: int("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    name: varchar("name", { length: 150 }).notNull(),
    variantLabel: varchar("variant_label", { length: 255 }).notNull().default(""),
    unitPricePence: int("unit_price_pence").notNull(),
    quantity: int("quantity").notNull(),
    imagePath: varchar("image_path", { length: 255 }),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

/**
 * One payment from a customer. A single payment can cover an order, a booking or
 * both; orderPence and bookingPence say how it is split.
 */
export const payments = mysqlTable(
  "payments",
  {
    id: int("id").autoincrement().primaryKey(),
    reference: varchar("reference", { length: 20 }).notNull().unique(),
    userId: varchar("user_id", { length: 36 }).references(() => user.id, { onDelete: "set null" }),
    orderId: int("order_id").references(() => orders.id, { onDelete: "cascade" }),
    bookingId: int("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    purpose: mysqlEnum("purpose", ["checkout", "balance"]).notNull().default("checkout"),
    method: mysqlEnum("method", paymentMethods).notNull().default("paypal"),
    status: mysqlEnum("status", paymentStatuses).notNull().default("pending"),
    amountPence: int("amount_pence").notNull(),
    orderPence: int("order_pence").notNull().default(0),
    bookingPence: int("booking_pence").notNull().default(0),
    tokenNonce: varchar("token_nonce", { length: 32 }).notNull(),
    paypalOrderId: varchar("paypal_order_id", { length: 64 }),
    captureId: varchar("capture_id", { length: 64 }),
    note: varchar("note", { length: 255 }).notNull().default(""),
    expiresAt: utc("expires_at"),
    completedAt: utc("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("payments_order_idx").on(t.orderId),
    index("payments_booking_idx").on(t.bookingId),
    index("payments_user_idx").on(t.userId),
    index("payments_paypal_idx").on(t.paypalOrderId),
    index("payments_capture_idx").on(t.captureId),
    index("payments_status_idx").on(t.status, t.expiresAt),
  ],
);

export const refunds = mysqlTable(
  "refunds",
  {
    id: int("id").autoincrement().primaryKey(),
    paymentId: int("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    amountPence: int("amount_pence").notNull(),
    orderPence: int("order_pence").notNull().default(0),
    bookingPence: int("booking_pence").notNull().default(0),
    /** Unique, so a repeated notification is only counted once */
    providerRefundId: varchar("provider_refund_id", { length: 64 }).unique(),
    note: varchar("note", { length: 255 }).notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("refunds_payment_idx").on(t.paymentId)],
);

export const webhookEvents = mysqlTable("webhook_events", {
  id: varchar("id", { length: 255 }).primaryKey(),
  type: varchar("type", { length: 100 }).notNull(),
  createdAt: createdAt(),
});
