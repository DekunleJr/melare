import {
  boolean,
  index,
  int,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { user } from "./auth";
import { products, services } from "./catalog";
import { createdAt, updatedAt, utc } from "./columns";
import { bookings, orders } from "./sales";

export const reviews = mysqlTable(
  "reviews",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: varchar("user_id", { length: 36 }).references(() => user.id, { onDelete: "set null" }),
    authorName: varchar("author_name", { length: 120 }).notNull(),
    productId: int("product_id").references(() => products.id, { onDelete: "cascade" }),
    serviceId: int("service_id").references(() => services.id, { onDelete: "cascade" }),
    /** Proof of purchase: exactly one of orderId / bookingId is set */
    orderId: int("order_id").references(() => orders.id, { onDelete: "cascade" }),
    bookingId: int("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    rating: int("rating").notNull(),
    comment: text("comment").notNull(),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("reviews_order_product_idx").on(t.orderId, t.productId),
    uniqueIndex("reviews_booking_idx").on(t.bookingId),
    index("reviews_status_idx").on(t.status),
  ],
);

export const galleryImages = mysqlTable("gallery_images", {
  id: int("id").autoincrement().primaryKey(),
  path: varchar("path", { length: 255 }).notNull(),
  caption: varchar("caption", { length: 200 }).notNull().default(""),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const faqs = mysqlTable("faqs", {
  id: int("id").autoincrement().primaryKey(),
  question: varchar("question", { length: 300 }).notNull(),
  answer: text("answer").notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(true),
});

export const contactMessages = mysqlTable("contact_messages", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull().default(""),
  subject: varchar("subject", { length: 200 }).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["new", "read", "archived"]).notNull().default("new"),
  createdAt: createdAt(),
});

export const subscribers = mysqlTable("subscribers", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  /** Random value mixed into the unsubscribe link */
  tokenNonce: varchar("token_nonce", { length: 32 }).notNull().default(""),
  createdAt: createdAt(),
});

/** Editable policy and information pages */
export const contentPages = mysqlTable("content_pages", {
  slug: varchar("slug", { length: 60 }).primaryKey(),
  title: varchar("title", { length: 150 }).notNull(),
  body: mediumtext("body").notNull(),
  updatedAt: updatedAt(),
});

export const posts = mysqlTable(
  "posts",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 220 }).notNull().unique(),
    excerpt: varchar("excerpt", { length: 400 }).notNull().default(""),
    body: mediumtext("body").notNull(),
    coverImage: varchar("cover_image", { length: 255 }),
    status: mysqlEnum("status", ["draft", "published"]).notNull().default("draft"),
    publishedAt: utc("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("posts_status_idx").on(t.status, t.publishedAt)],
);

/** Baskets of people who asked to be reminded if they do not finish checking out */
export const savedCarts = mysqlTable("saved_carts", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull().default(""),
  /** JSON list of { variantId, quantity } */
  items: text("items").notNull(),
  tokenNonce: varchar("token_nonce", { length: 32 }).notNull(),
  remindedAt: utc("reminded_at"),
  updatedAt: updatedAt(),
});

export const emailLog = mysqlTable(
  "email_log",
  {
    id: int("id").autoincrement().primaryKey(),
    toAddress: varchar("to_address", { length: 255 }).notNull(),
    replyTo: varchar("reply_to", { length: 255 }),
    subject: varchar("subject", { length: 255 }).notNull(),
    html: mediumtext("html").notNull(),
    text: mediumtext("text").notNull(),
    ics: text("ics"),
    kind: varchar("kind", { length: 60 }).notNull(),
    status: mysqlEnum("status", ["queued", "sent", "logged", "failed"]).notNull().default("queued"),
    error: text("error"),
    createdAt: createdAt(),
    sentAt: utc("sent_at"),
  },
  (t) => [index("email_log_created_idx").on(t.createdAt)],
);

export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
});
