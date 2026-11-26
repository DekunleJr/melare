"use server";

import { and, asc, eq, ne } from "drizzle-orm";
import type { MySqlTable } from "drizzle-orm/mysql-core";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  bookings,
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
  timeOff,
  workingHours,
} from "@/db/schema";
import {
  depositTypes,
  locationModes,
  paymentModes,
  publishStatus,
} from "@/db/schema/catalog";
import { formObject, runAction } from "@/lib/actions";
import { UserError } from "@/lib/errors";
import type { FormState } from "@/lib/forms";
import { requireAdmin } from "@/lib/session";
import { deleteImage, saveImage } from "@/lib/storage";
import { TAGS } from "@/lib/tags";
import { parseLocalDateTime, timeToMinutes, WEEKDAYS } from "@/lib/time";
import {
  checkbox,
  id,
  money,
  optionalText,
  requiredText,
  slugify,
  wholeNumber,
} from "@/lib/validation";

const MIN_CHARGE = 30;

/** The two choices offered by the switch in the admin lists. */
const listStatus = z.enum(["active", "archived"]);

type SluggedTable = typeof products | typeof services | typeof categories;

async function uniqueSlug(table: SluggedTable, name: string, currentId?: number) {
  const base = slugify(name);
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const [clash] = await db
      .select({ id: table.id })
      .from(table as MySqlTable)
      .where(and(eq(table.slug, slug), currentId ? ne(table.id, currentId) : undefined));
    if (!clash) return slug;
  }
}

// ---------- Products ----------

const productSchema = z.object({
  name: requiredText(150),
  description: requiredText(5000),
  categoryId: z.coerce.number().int().min(0),
  status: z.enum(publishStatus),
  featured: checkbox,
});

const price = money.refine((p) => p >= MIN_CHARGE, "The price must be at least £0.30.");

const variantSchema = z
  .object({
    colour: optionalText(60),
    length: optionalText(60),
    texture: optionalText(60),
    size: optionalText(60),
    sku: optionalText(60),
    price,
    salePrice: z.union([z.literal("").transform(() => 0), money]),
    stock: wholeNumber(0, 100_000),
    lowStockThreshold: wholeNumber(0, 1000),
    sortOrder: wholeNumber(0, 1000),
    active: checkbox,
  })
  .superRefine((data, ctx) => {
    if (data.salePrice && (data.salePrice < MIN_CHARGE || data.salePrice >= data.price)) {
      ctx.addIssue({
        code: "custom",
        path: ["salePrice"],
        message: "A sale price must be lower than the normal price.",
      });
    }
  });

async function imageStillNeeded(path: string) {
  const [used] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(eq(orderItems.imagePath, path))
    .limit(1);
  return Boolean(used);
}

export async function saveVariant(
  productId: number,
  variantId: number | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const target = id.parse(productId);
    const { price: pricePence, salePrice, ...data } = variantSchema.parse(formObject(formData));
    const image = await saveImage(formData.get("image"));
    const values = {
      ...data,
      pricePence,
      salePricePence: salePrice,
      ...(image ? { imagePath: image } : {}),
    };
    if (variantId) {
      const where = and(eq(productVariants.id, id.parse(variantId)), eq(productVariants.productId, target));
      const [old] = await db.select().from(productVariants).where(where);
      await db.update(productVariants).set(values).where(where);
      if (image && old?.imagePath && !(await imageStillNeeded(old.imagePath))) {
        await deleteImage(old.imagePath);
      }
    } else {
      await db.insert(productVariants).values({ ...values, productId: target });
    }
    updateTag(TAGS.products);
    return { ok: true, message: "Option saved." };
  });
}

export async function deleteVariant(variantId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, id.parse(variantId)));
    if (!variant) throw new UserError("Option not found.");
    const siblings = await db
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.productId, variant.productId));
    if (siblings.length < 2) throw new UserError("A product needs at least one option.");
    const [sold] = await db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.variantId, variant.id))
      .limit(1);
    if (sold) {
      await db.update(productVariants).set({ active: false }).where(eq(productVariants.id, variant.id));
      updateTag(TAGS.products);
      return { ok: true, message: "This option has been sold before, so it was hidden." };
    }
    await db.delete(productVariants).where(eq(productVariants.id, variant.id));
    if (variant.imagePath) await deleteImage(variant.imagePath);
    updateTag(TAGS.products);
    return { ok: true, message: "Option removed." };
  });
}

export async function saveProduct(
  productId: number | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const fields = formObject(formData);
    const { categoryId, ...data } = productSchema.parse(fields);
    const values = { ...data, categoryId: categoryId || null };
    // A new product starts with one option; more can be added afterwards.
    const first = productId
      ? null
      : z
          .object({
            price,
            stock: wholeNumber(0, 100_000),
            colour: optionalText(60),
            length: optionalText(60),
            texture: optionalText(60),
            size: optionalText(60),
          })
          .parse(fields);

    const uploads: string[] = [];
    try {
      for (const file of formData.getAll("images").slice(0, 6)) {
        const path = await saveImage(file);
        if (path) uploads.push(path);
      }
    } catch (error) {
      await Promise.all(uploads.map(deleteImage));
      throw error;
    }

    let targetId = productId;
    if (targetId) {
      await db.update(products).set(values).where(eq(products.id, targetId));
    } else {
      const [row] = await db
        .insert(products)
        .values({ ...values, slug: await uniqueSlug(products, values.name) })
        .$returningId();
      targetId = row.id;
      const { price: pricePence, ...option } = first!;
      await db.insert(productVariants).values({ productId: targetId, pricePence, ...option });
    }
    if (uploads.length) {
      const existing = await db
        .select({ sortOrder: productImages.sortOrder })
        .from(productImages)
        .where(eq(productImages.productId, targetId));
      const start = existing.reduce((max, i) => Math.max(max, i.sortOrder + 1), 0);
      await db
        .insert(productImages)
        .values(uploads.map((path, i) => ({ productId: targetId, path, sortOrder: start + i })));
    }
    updateTag(TAGS.products);
    if (!productId) redirect(`/admin/products/${targetId}?created=1`);
    return { ok: true, message: "Product saved." };
  });
}

export async function removeProductImage(imageId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const [image] = await db.select().from(productImages).where(eq(productImages.id, id.parse(imageId)));
    if (image) {
      await db.delete(productImages).where(eq(productImages.id, image.id));
      if (!(await imageStillNeeded(image.path))) await deleteImage(image.path);
    }
    updateTag(TAGS.products);
    return { ok: true, message: "Image removed." };
  });
}

export async function makeMainImage(imageId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const [image] = await db.select().from(productImages).where(eq(productImages.id, id.parse(imageId)));
    if (!image) throw new UserError("Image not found.");
    const all = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, image.productId))
      .orderBy(asc(productImages.sortOrder), asc(productImages.id));
    const ordered = [image, ...all.filter((i) => i.id !== image.id)];
    for (const [sortOrder, item] of ordered.entries()) {
      await db.update(productImages).set({ sortOrder }).where(eq(productImages.id, item.id));
    }
    updateTag(TAGS.products);
    return { ok: true, message: "Main image updated." };
  });
}

/** Deletes a product, or archives it when past orders still refer to it. */
async function removeProduct(productId: number): Promise<"deleted" | "archived"> {
  const target = id.parse(productId);
  const [sold] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(eq(orderItems.productId, target))
    .limit(1);
  if (sold) {
    await db.update(products).set({ status: "archived" }).where(eq(products.id, target));
    updateTag(TAGS.products);
    return "archived";
  }
  const images = await db.select().from(productImages).where(eq(productImages.productId, target));
  const options = await db.select().from(productVariants).where(eq(productVariants.productId, target));
  await db.delete(products).where(eq(products.id, target));
  for (const image of images) await deleteImage(image.path);
  for (const option of options) if (option.imagePath) await deleteImage(option.imagePath);
  updateTag(TAGS.products);
  return "deleted";
}

const archivedInstead: FormState = {
  ok: true,
  message: "This product has been sold before, so it was archived.",
};

/** Delete from the product's own page, which then returns to the list. */
export async function deleteProduct(productId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    if ((await removeProduct(productId)) === "archived") return archivedInstead;
    redirect("/admin/products");
  });
}

/** Delete from the product list, which stays where it is (keeping any search). */
export async function deleteListedProduct(productId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () =>
    (await removeProduct(productId)) === "archived" ? archivedInstead : { ok: true },
  );
}

/** The Active / Archived switch in the product list. */
export async function setProductStatus(
  productId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const status = listStatus.parse(formData.get("status"));
    await db.update(products).set({ status }).where(eq(products.id, id.parse(productId)));
    updateTag(TAGS.products);
    return { ok: true };
  });
}

// ---------- Categories ----------

export async function saveCategory(
  categoryId: number | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const data = z
      .object({ name: requiredText(100), sortOrder: wholeNumber(0, 1000) })
      .parse(formObject(formData));
    if (categoryId) {
      await db.update(categories).set(data).where(eq(categories.id, id.parse(categoryId)));
    } else {
      await db
        .insert(categories)
        .values({ ...data, slug: await uniqueSlug(categories, data.name) });
    }
    updateTag(TAGS.products);
    return { ok: true, message: "Category saved." };
  });
}

export async function deleteCategory(categoryId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    await db.delete(categories).where(eq(categories.id, id.parse(categoryId)));
    updateTag(TAGS.products);
    return { ok: true, message: "Category deleted." };
  });
}

// ---------- Services ----------

const serviceSchema = z
  .object({
    name: requiredText(150),
    category: requiredText(100),
    description: requiredText(5000),
    durationMinutes: wholeNumber(5, 600),
    bufferMinutes: wholeNumber(0, 240),
    price: money,
    paymentMode: z.enum(paymentModes),
    depositType: z.enum(depositTypes),
    deposit: z.union([z.literal("").transform(() => 0), money]),
    depositPercent: z.union([z.literal("").transform(() => 0), wholeNumber(0, 100)]),
    locationMode: z.enum(locationModes),
    suggestedCategoryId: z.coerce.number().int().min(0),
    requiresApproval: checkbox,
    sortOrder: wholeNumber(0, 1000),
    status: z.enum(publishStatus),
    featured: checkbox,
  })
  .superRefine((data, ctx) => {
    if (data.paymentMode === "full" && data.price < MIN_CHARGE) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Online payment needs at least £0.30." });
    }
    if (data.paymentMode !== "deposit") return;
    if (data.depositType === "fixed" && (data.deposit < MIN_CHARGE || data.deposit > data.price)) {
      ctx.addIssue({
        code: "custom",
        path: ["deposit"],
        message: "Enter a deposit from £0.30 up to the price.",
      });
    }
    if (data.depositType === "percent" && data.depositPercent < 1) {
      ctx.addIssue({ code: "custom", path: ["depositPercent"], message: "Enter 1 to 100." });
    }
  });

export async function saveService(
  serviceId: number | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const {
      price: pricePence,
      deposit,
      suggestedCategoryId,
      ...data
    } = serviceSchema.parse(formObject(formData));
    const photos: string[] = [];
    for (const file of formData.getAll("photos").slice(0, 6)) {
      const path = await saveImage(file);
      if (path) photos.push(path);
    }
    const image = await saveImage(formData.get("image"));
    const usesDeposit = data.paymentMode === "deposit";
    const values = {
      ...data,
      pricePence,
      depositPence: usesDeposit && data.depositType === "fixed" ? deposit : 0,
      depositPercent: usesDeposit && data.depositType === "percent" ? data.depositPercent : 0,
      suggestedCategoryId: suggestedCategoryId || null,
      ...(image ? { imagePath: image } : {}),
    };
    let targetId = serviceId;
    if (targetId) {
      const [old] = await db.select().from(services).where(eq(services.id, targetId));
      await db.update(services).set(values).where(eq(services.id, targetId));
      if (image) await deleteImage(old?.imagePath);
    } else {
      const [row] = await db
        .insert(services)
        .values({ ...values, slug: await uniqueSlug(services, values.name) })
        .$returningId();
      targetId = row.id;
    }

    if (photos.length) {
      await db.insert(serviceImages).values(photos.map((path) => ({ serviceId: targetId, path })));
    }

    // Which staff offer this service
    const staffIds = formData.getAll("staffIds").map((v) => id.parse(v));
    await db.delete(staffServices).where(eq(staffServices.serviceId, targetId));
    if (staffIds.length) {
      await db
        .insert(staffServices)
        .values(staffIds.map((staffId) => ({ staffId, serviceId: targetId })));
    }
    updateTag(TAGS.services);
    if (!serviceId) redirect(`/admin/services/${targetId}?created=1`);
    return { ok: true, message: "Service saved." };
  });
}

/** Deletes a service, or archives it when bookings still refer to it. */
async function removeService(serviceId: number): Promise<"deleted" | "archived"> {
  const target = id.parse(serviceId);
  const [booked] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.serviceId, target))
    .limit(1);
  if (booked) {
    await db.update(services).set({ status: "archived" }).where(eq(services.id, target));
    updateTag(TAGS.services);
    return "archived";
  }
  const [old] = await db.select().from(services).where(eq(services.id, target));
  const photos = await db.select().from(serviceImages).where(eq(serviceImages.serviceId, target));
  await db.delete(services).where(eq(services.id, target));
  await deleteImage(old?.imagePath);
  for (const photo of photos) await deleteImage(photo.path);
  updateTag(TAGS.services);
  return "deleted";
}

const serviceArchivedInstead: FormState = {
  ok: true,
  message: "This service has bookings, so it was archived.",
};

/** Delete from the service's own page, which then returns to the list. */
export async function deleteService(serviceId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    if ((await removeService(serviceId)) === "archived") return serviceArchivedInstead;
    redirect("/admin/services");
  });
}

/** Delete from the service list. */
export async function deleteListedService(serviceId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () =>
    (await removeService(serviceId)) === "archived" ? serviceArchivedInstead : { ok: true },
  );
}

/** The Active / Archived switch in the service list. */
export async function setServiceStatus(
  serviceId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const status = listStatus.parse(formData.get("status"));
    await db.update(services).set({ status }).where(eq(services.id, id.parse(serviceId)));
    updateTag(TAGS.services);
    return { ok: true };
  });
}

export async function removeServicePhoto(photoId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const [photo] = await db.select().from(serviceImages).where(eq(serviceImages.id, id.parse(photoId)));
    if (photo) {
      await db.delete(serviceImages).where(eq(serviceImages.id, photo.id));
      await deleteImage(photo.path);
    }
    updateTag(TAGS.services);
    return { ok: true, message: "Photo removed." };
  });
}

export async function saveAddon(
  serviceId: number,
  addonId: number | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const target = id.parse(serviceId);
    const { price: pricePence, ...data } = z
      .object({
        name: requiredText(120),
        price: money,
        extraMinutes: wholeNumber(0, 480),
        sortOrder: wholeNumber(0, 1000),
        active: checkbox,
      })
      .parse(formObject(formData));
    const values = { ...data, pricePence, serviceId: target };
    if (addonId) {
      await db
        .update(serviceAddons)
        .set(values)
        .where(and(eq(serviceAddons.id, id.parse(addonId)), eq(serviceAddons.serviceId, target)));
    } else await db.insert(serviceAddons).values(values);
    updateTag(TAGS.services);
    return { ok: true, message: "Extra saved." };
  });
}

export async function deleteAddon(addonId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    // Past bookings keep their own copy of the name and price.
    await db.delete(serviceAddons).where(eq(serviceAddons.id, id.parse(addonId)));
    updateTag(TAGS.services);
    return { ok: true, message: "Extra removed." };
  });
}

// ---------- Staff ----------

export async function saveStaff(
  staffId: number | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const data = z
      .object({
        name: requiredText(120),
        title: optionalText(120),
        bio: optionalText(2000),
        sortOrder: wholeNumber(0, 1000),
        active: checkbox,
        offersMobile: checkbox,
      })
      .parse(formObject(formData));
    const image = await saveImage(formData.get("image"));
    const values = { ...data, ...(image ? { imagePath: image } : {}) };
    let targetId = staffId;
    if (targetId) {
      const [old] = await db.select().from(staff).where(eq(staff.id, targetId));
      await db.update(staff).set(values).where(eq(staff.id, targetId));
      if (image) await deleteImage(old?.imagePath);
    } else {
      const [row] = await db.insert(staff).values(values).$returningId();
      targetId = row.id;
    }
    const serviceIds = formData.getAll("serviceIds").map((v) => id.parse(v));
    await db.delete(staffServices).where(eq(staffServices.staffId, targetId));
    if (serviceIds.length) {
      await db
        .insert(staffServices)
        .values(serviceIds.map((serviceId) => ({ staffId: targetId, serviceId })));
    }
    updateTag(TAGS.staff);
    updateTag(TAGS.services);
    if (!staffId) redirect(`/admin/staff/${targetId}?created=1`);
    return { ok: true, message: "Profile saved." };
  });
}

/** Deletes a team member, or archives them when bookings still refer to them. */
async function removeStaff(staffId: number): Promise<"deleted" | "archived"> {
  const target = id.parse(staffId);
  const [booked] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.staffId, target))
    .limit(1);
  if (booked) {
    await db.update(staff).set({ active: false }).where(eq(staff.id, target));
    updateTag(TAGS.staff);
    updateTag(TAGS.services);
    return "archived";
  }
  const [old] = await db.select().from(staff).where(eq(staff.id, target));
  await db.delete(staff).where(eq(staff.id, target));
  await deleteImage(old?.imagePath);
  updateTag(TAGS.staff);
  updateTag(TAGS.services);
  return "deleted";
}

const staffArchivedInstead: FormState = {
  ok: true,
  message: "This person has bookings, so they were archived.",
};

/** Delete from the person's own page, which then returns to the list. */
export async function deleteStaff(staffId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    if ((await removeStaff(staffId)) === "archived") return staffArchivedInstead;
    redirect("/admin/staff");
  });
}

/** Delete from the staff list. */
export async function deleteListedStaff(staffId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () =>
    (await removeStaff(staffId)) === "archived" ? staffArchivedInstead : { ok: true },
  );
}

/** The Active / Archived switch in the staff list. Archived staff cannot be booked. */
export async function setStaffStatus(
  staffId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const active = listStatus.parse(formData.get("status")) === "active";
    await db.update(staff).set({ active }).where(eq(staff.id, id.parse(staffId)));
    updateTag(TAGS.staff);
    updateTag(TAGS.services);
    return { ok: true };
  });
}

export async function saveHours(
  staffId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const target = id.parse(staffId);
    const rows: (typeof workingHours.$inferInsert)[] = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      if (formData.get(`open_${weekday}`) !== "on") continue;
      const read = (name: string) => timeToMinutes(String(formData.get(`${name}_${weekday}`) ?? ""));
      const [start, end, breakStart, breakEnd] = ["start", "end", "breakStart", "breakEnd"].map(read);
      const day = WEEKDAYS[weekday];
      if (start === null || end === null || end <= start) {
        throw new UserError(`${day}: the finish time must be after the start time.`);
      }
      if (breakStart === null && breakEnd === null) {
        rows.push({ staffId: target, weekday, startMinute: start, endMinute: end });
        continue;
      }
      if (
        breakStart === null ||
        breakEnd === null ||
        !(start < breakStart && breakStart < breakEnd && breakEnd < end)
      ) {
        throw new UserError(`${day}: the break must fall inside working hours.`);
      }
      rows.push(
        { staffId: target, weekday, startMinute: start, endMinute: breakStart },
        { staffId: target, weekday, startMinute: breakEnd, endMinute: end },
      );
    }
    await db.transaction(async (tx) => {
      await tx.delete(workingHours).where(eq(workingHours.staffId, target));
      if (rows.length) await tx.insert(workingHours).values(rows);
    });
    return { ok: true, message: "Working hours saved." };
  });
}

export async function addTimeOff(
  staffId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const startsAt = parseLocalDateTime(String(formData.get("startsAt")));
    const endsAt = parseLocalDateTime(String(formData.get("endsAt")));
    if (!startsAt || !endsAt || endsAt <= startsAt) {
      throw new UserError("Choose a start and a later end time.");
    }
    const reason = optionalText(200).parse(formData.get("reason") ?? "");
    await db.insert(timeOff).values({ staffId: id.parse(staffId), startsAt, endsAt, reason });
    return { ok: true, message: "Time off added. Existing bookings are not changed." };
  });
}

export async function removeTimeOff(timeOffId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    await db.delete(timeOff).where(eq(timeOff.id, id.parse(timeOffId)));
    return { ok: true, message: "Removed." };
  });
}
