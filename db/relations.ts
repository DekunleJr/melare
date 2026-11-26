import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  categories,
  orderItems,
  productImages,
  productVariants,
  products,
  serviceAddons,
  serviceImages,
  services,
  staff,
  staffServices,
  workingHours,
} from "./schema";

/*
 * Related rows are fetched with plain follow-up queries. Drizzle's relational query
 * API emits SQL (LATERAL / correlated derived tables) that MariaDB cannot run.
 */

export function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const row of rows) {
    const group = groups.get(key(row));
    if (group) group.push(row);
    else groups.set(key(row), [row]);
  }
  return groups;
}

/** Adds each product's category, options and image paths, main image first. */
export async function withProductDetails<T extends typeof products.$inferSelect>(rows: T[]) {
  if (!rows.length) return [];
  const images = await db
    .select()
    .from(productImages)
    .where(inArray(productImages.productId, rows.map((r) => r.id)))
    .orderBy(asc(productImages.sortOrder), asc(productImages.id));
  const byProduct = groupBy(images, (i) => i.productId);
  const allCategories = await db.select().from(categories);
  const options = await db
    .select()
    .from(productVariants)
    .where(inArray(productVariants.productId, rows.map((r) => r.id)))
    .orderBy(asc(productVariants.sortOrder), asc(productVariants.id));
  const optionsByProduct = groupBy(options, (v) => v.productId);
  return rows.map((product) => ({
    variants: optionsByProduct.get(product.id) ?? [],
    ...product,
    category: allCategories.find((c) => c.id === product.categoryId) ?? null,
    images: (byProduct.get(product.id) ?? []).map((i) => i.path),
  }));
}

/** Adds the staff who offer each service. */
export async function withServiceStaff<T extends typeof services.$inferSelect>(rows: T[]) {
  if (!rows.length) return [];
  const links = await db
    .select({ serviceId: staffServices.serviceId, person: staff })
    .from(staffServices)
    .innerJoin(staff, eq(staff.id, staffServices.staffId))
    .where(inArray(staffServices.serviceId, rows.map((r) => r.id)))
    .orderBy(asc(staff.sortOrder), asc(staff.name));
  const byService = groupBy(links, (l) => l.serviceId);
  return rows.map((service) => ({
    ...service,
    staff: (byService.get(service.id) ?? []).map((l) => l.person),
  }));
}

/** Adds each service's extra charges and extra photographs. */
export async function withServiceExtras<T extends typeof services.$inferSelect>(rows: T[]) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const addons = await db
    .select()
    .from(serviceAddons)
    .where(inArray(serviceAddons.serviceId, ids))
    .orderBy(asc(serviceAddons.sortOrder), asc(serviceAddons.id));
  const photos = await db
    .select()
    .from(serviceImages)
    .where(inArray(serviceImages.serviceId, ids))
    .orderBy(asc(serviceImages.id));
  const addonsByService = groupBy(addons, (a) => a.serviceId);
  const photosByService = groupBy(photos, (p) => p.serviceId);
  return rows.map((service) => ({
    ...service,
    addons: addonsByService.get(service.id) ?? [],
    photos: photosByService.get(service.id) ?? [],
  }));
}

/** Adds each person's services and weekly shifts. */
export async function withStaffDetails<T extends typeof staff.$inferSelect>(rows: T[]) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const links = await db
    .select({ staffId: staffServices.staffId, service: services })
    .from(staffServices)
    .innerJoin(services, eq(services.id, staffServices.serviceId))
    .where(inArray(staffServices.staffId, ids))
    .orderBy(asc(services.sortOrder), asc(services.name));
  const hours = await db.select().from(workingHours).where(inArray(workingHours.staffId, ids));
  const servicesByStaff = groupBy(links, (l) => l.staffId);
  const hoursByStaff = groupBy(hours, (h) => h.staffId);
  return rows.map((person) => ({
    ...person,
    services: (servicesByStaff.get(person.id) ?? []).map((l) => l.service),
    hours: hoursByStaff.get(person.id) ?? [],
  }));
}

export async function withOrderItems<T extends { id: number }>(rows: T[]) {
  if (!rows.length) return [];
  const items = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, rows.map((r) => r.id)))
    .orderBy(asc(orderItems.id));
  const byOrder = groupBy(items, (i) => i.orderId);
  return rows.map((order) => ({ ...order, items: byOrder.get(order.id) ?? [] }));
}
