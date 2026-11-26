import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { createdAt, updatedAt, utc } from "./columns";

export const publishStatus = ["active", "draft", "archived"] as const;
export const paymentModes = ["pay_at_salon", "deposit", "full"] as const;
export const depositTypes = ["fixed", "percent"] as const;
export const locationModes = ["salon", "mobile", "both"] as const;

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  sortOrder: int("sort_order").notNull().default(0),
});

/** Price and stock live on variants. Every product has at least one. */
export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    categoryId: int("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: varchar("name", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 170 }).notNull().unique(),
    description: text("description").notNull(),
    featured: boolean("featured").notNull().default(false),
    status: mysqlEnum("status", publishStatus).notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("products_status_idx").on(t.status)],
);

export const productVariants = mysqlTable(
  "product_variants",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    colour: varchar("colour", { length: 60 }).notNull().default(""),
    length: varchar("length", { length: 60 }).notNull().default(""),
    texture: varchar("texture", { length: 60 }).notNull().default(""),
    size: varchar("size", { length: 60 }).notNull().default(""),
    sku: varchar("sku", { length: 60 }).notNull().default(""),
    pricePence: int("price_pence").notNull(),
    /** 0 means not on sale */
    salePricePence: int("sale_price_pence").notNull().default(0),
    stock: int("stock").notNull().default(0),
    lowStockThreshold: int("low_stock_threshold").notNull().default(3),
    imagePath: varchar("image_path", { length: 255 }),
    active: boolean("active").notNull().default(true),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [index("product_variants_product_idx").on(t.productId)],
);

export const productImages = mysqlTable(
  "product_images",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    path: varchar("path", { length: 255 }).notNull(),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  slug: varchar("slug", { length: 170 }).notNull().unique(),
  category: varchar("category", { length: 100 }).notNull().default("General"),
  description: text("description").notNull(),
  durationMinutes: int("duration_minutes").notNull(),
  bufferMinutes: int("buffer_minutes").notNull().default(0),
  pricePence: int("price_pence").notNull(),
  paymentMode: mysqlEnum("payment_mode", paymentModes).notNull().default("pay_at_salon"),
  depositType: mysqlEnum("deposit_type", depositTypes).notNull().default("fixed"),
  depositPence: int("deposit_pence").notNull().default(0),
  depositPercent: int("deposit_percent").notNull().default(0),
  locationMode: mysqlEnum("location_mode", locationModes).notNull().default("salon"),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  /** Products from this category are offered first while booking */
  suggestedCategoryId: int("suggested_category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  imagePath: varchar("image_path", { length: 255 }),
  featured: boolean("featured").notNull().default(false),
  status: mysqlEnum("status", publishStatus).notNull().default("active"),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Extra hairstyle photographs, in addition to the service's cover image. */
export const serviceImages = mysqlTable(
  "service_images",
  {
    id: int("id").autoincrement().primaryKey(),
    serviceId: int("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    path: varchar("path", { length: 255 }).notNull(),
  },
  (t) => [index("service_images_service_idx").on(t.serviceId)],
);

/** Optional extra charges chosen while booking. */
export const serviceAddons = mysqlTable(
  "service_addons",
  {
    id: int("id").autoincrement().primaryKey(),
    serviceId: int("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    pricePence: int("price_pence").notNull(),
    extraMinutes: int("extra_minutes").notNull().default(0),
    active: boolean("active").notNull().default(true),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [index("service_addons_service_idx").on(t.serviceId)],
);

export const staff = mysqlTable("staff", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  title: varchar("title", { length: 120 }).notNull().default(""),
  bio: text("bio").notNull(),
  imagePath: varchar("image_path", { length: 255 }),
  active: boolean("active").notNull().default(true),
  offersMobile: boolean("offers_mobile").notNull().default(false),
  sortOrder: int("sort_order").notNull().default(0),
});

export const staffServices = mysqlTable(
  "staff_services",
  {
    staffId: int("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    serviceId: int("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.serviceId] })],
);

export const workingHours = mysqlTable(
  "working_hours",
  {
    id: int("id").autoincrement().primaryKey(),
    staffId: int("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    /** 0 = Sunday ... 6 = Saturday */
    weekday: int("weekday").notNull(),
    /** Minutes after local (salon) midnight */
    startMinute: int("start_minute").notNull(),
    endMinute: int("end_minute").notNull(),
  },
  (t) => [index("working_hours_staff_idx").on(t.staffId, t.weekday)],
);

export const timeOff = mysqlTable(
  "time_off",
  {
    id: int("id").autoincrement().primaryKey(),
    staffId: int("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    startsAt: utc("starts_at").notNull(),
    endsAt: utc("ends_at").notNull(),
    reason: varchar("reason", { length: 200 }).notNull().default(""),
  },
  (t) => [index("time_off_staff_idx").on(t.staffId, t.startsAt)],
);

/** Where mobile appointments are offered. "M14" is one district; "M" is the whole area. */
export const mobileAreas = mysqlTable(
  "mobile_areas",
  {
    id: int("id").autoincrement().primaryKey(),
    district: varchar("district", { length: 8 }).notNull(),
    feePence: int("fee_pence").notNull().default(0),
    /** Blocked in the diary before and after the appointment */
    travelMinutes: int("travel_minutes").notNull().default(30),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("mobile_areas_district_idx").on(t.district)],
);
