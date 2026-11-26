"use server";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { contentPages, deliveryMethods, discountCodes, mobileAreas, posts } from "@/db/schema";
import { discountScopes, discountTypes } from "@/db/schema/sales";
import { syncAllSubscribers } from "@/features/marketing";
import { formObject, runAction } from "@/lib/actions";
import { createBackup } from "@/lib/backup";
import { PAGE_SLUGS } from "@/lib/default-pages";
import { isDuplicateEntry, UserError } from "@/lib/errors";
import type { FormState } from "@/lib/forms";
import { parsePounds } from "@/lib/money";
import { normaliseDistrict, parseDistrictList } from "@/lib/postcode";
import { requireAdmin } from "@/lib/session";
import { writeSettings } from "@/lib/settings";
import { deleteImage, saveImage } from "@/lib/storage";
import { TAGS } from "@/lib/tags";
import { parseLocalDateTime } from "@/lib/time";
import { newNonce } from "@/lib/tokens";
import {
  checkbox,
  id,
  money,
  optionalText,
  requiredText,
  slugify,
  wholeNumber,
} from "@/lib/validation";

const orZero = z.union([z.literal("").transform(() => 0), money]);

// ---------- Discount codes ----------

export async function saveDiscount(
  discountId: number | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const data = z
      .object({
        code: requiredText(40)
          .transform((c) => c.toUpperCase())
          .refine((c) => /^[A-Z0-9_-]{3,}$/.test(c), "Use at least 3 letters or numbers, no spaces."),
        type: z.enum(discountTypes),
        value: requiredText(20),
        appliesTo: z.enum(discountScopes),
        minSpend: orZero,
        maxUses: wholeNumber(0, 1_000_000),
        startsAt: optionalText(30),
        endsAt: optionalText(30),
        active: checkbox,
      })
      .parse(formObject(formData));
    const value =
      data.type === "percent"
        ? /^\d{1,3}$/.test(data.value)
          ? Number(data.value)
          : null
        : parsePounds(data.value);
    if (!value || (data.type === "percent" && value > 100)) {
      return {
        message: "Please check the highlighted fields.",
        errors: {
          value: data.type === "percent" ? "Enter 1 to 100." : "Enter an amount such as 5.00.",
        },
      };
    }
    const date = (text: string) => {
      if (!text) return null;
      const parsed = parseLocalDateTime(text);
      if (!parsed) throw new UserError("Enter valid dates.");
      return parsed;
    };
    const startsAt = date(data.startsAt);
    const endsAt = date(data.endsAt);
    if (startsAt && endsAt && endsAt <= startsAt) {
      throw new UserError("The end must be after the start.");
    }
    const values = {
      code: data.code,
      type: data.type,
      value,
      appliesTo: data.appliesTo,
      minSpendPence: data.minSpend,
      maxUses: data.maxUses,
      startsAt,
      endsAt,
      active: data.active,
    };
    try {
      if (discountId) {
        await db.update(discountCodes).set(values).where(eq(discountCodes.id, id.parse(discountId)));
      } else await db.insert(discountCodes).values(values);
    } catch (error) {
      if (isDuplicateEntry(error)) throw new UserError("That code already exists.");
      throw error;
    }
    return { ok: true, message: "Code saved." };
  });
}

export async function deleteDiscount(discountId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    // Past orders and bookings keep the code text and the amount taken off.
    await db.delete(discountCodes).where(eq(discountCodes.id, id.parse(discountId)));
    return { ok: true, message: "Code deleted." };
  });
}

// ---------- Delivery methods ----------

export async function saveDeliveryMethod(
  methodId: number | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const data = z
      .object({
        name: requiredText(100),
        description: optionalText(200),
        price: money,
        freeOver: orZero,
        postcodes: optionalText(500),
        sortOrder: wholeNumber(0, 1000),
        active: checkbox,
      })
      .parse(formObject(formData));
    const list = parseDistrictList(data.postcodes);
    if (list.invalid.length) {
      return {
        message: "Please check the highlighted fields.",
        errors: { postcodes: `Not a postcode district: ${list.invalid.join(", ")}` },
      };
    }
    const { price: pricePence, freeOver: freeOverPence, ...rest } = data;
    const values = { ...rest, pricePence, freeOverPence, postcodes: list.valid.join(",") };
    if (methodId) {
      await db.update(deliveryMethods).set(values).where(eq(deliveryMethods.id, id.parse(methodId)));
    } else await db.insert(deliveryMethods).values(values);
    return { ok: true, message: "Delivery option saved." };
  });
}

export async function deleteDeliveryMethod(methodId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    await db.delete(deliveryMethods).where(eq(deliveryMethods.id, id.parse(methodId)));
    return { ok: true, message: "Delivery option removed." };
  });
}

// ---------- Mobile areas ----------

export async function saveMobileArea(
  areaId: number | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const data = z
      .object({
        districts: requiredText(500),
        fee: money,
        travelMinutes: wholeNumber(0, 480),
        active: checkbox,
      })
      .parse(formObject(formData));
    const values = { feePence: data.fee, travelMinutes: data.travelMinutes, active: data.active };
    if (areaId) {
      const district = normaliseDistrict(data.districts);
      if (!district) throw new UserError("Enter one postcode district, such as M14 or M.");
      try {
        await db.update(mobileAreas).set({ ...values, district }).where(eq(mobileAreas.id, id.parse(areaId)));
      } catch (error) {
        if (isDuplicateEntry(error)) throw new UserError("That district is already listed.");
        throw error;
      }
    } else {
      // Several districts can be added at once with the same fee.
      const list = parseDistrictList(data.districts);
      if (list.invalid.length || !list.valid.length) {
        throw new UserError(`Not a postcode district: ${list.invalid.join(", ")}`);
      }
      for (const district of list.valid) {
        await db
          .insert(mobileAreas)
          .values({ ...values, district })
          .onDuplicateKeyUpdate({ set: values });
      }
    }
    updateTag(TAGS.areas);
    return { ok: true, message: "Area saved." };
  });
}

export async function deleteMobileArea(areaId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    await db.delete(mobileAreas).where(eq(mobileAreas.id, id.parse(areaId)));
    updateTag(TAGS.areas);
    return { ok: true, message: "Area removed." };
  });
}

// ---------- Pages and blog ----------

export async function savePage(
  slug: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const target = z.enum(PAGE_SLUGS).parse(slug);
    const data = z
      .object({ title: requiredText(150), body: requiredText(50_000) })
      .parse(formObject(formData));
    await db
      .insert(contentPages)
      .values({ slug: target, ...data })
      .onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
    updateTag(TAGS.pages);
    return { ok: true, message: "Page saved." };
  });
}

export async function resetPage(slug: string): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    await db.delete(contentPages).where(eq(contentPages.slug, z.enum(PAGE_SLUGS).parse(slug)));
    updateTag(TAGS.pages);
    return { ok: true, message: "Restored the starting text. Reload to see it." };
  });
}

export async function savePost(
  postId: number | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const data = z
      .object({
        title: requiredText(200),
        excerpt: optionalText(400),
        body: requiredText(100_000),
        status: z.enum(["draft", "published"]),
      })
      .parse(formObject(formData));
    const image = await saveImage(formData.get("cover"));
    const old = postId
      ? (await db.select().from(posts).where(eq(posts.id, id.parse(postId))))[0]
      : undefined;
    const values = {
      ...data,
      ...(image ? { coverImage: image } : {}),
      publishedAt: data.status === "published" ? (old?.publishedAt ?? new Date()) : null,
    };
    if (old) {
      await db.update(posts).set(values).where(eq(posts.id, old.id));
      if (image) await deleteImage(old.coverImage);
      updateTag(TAGS.posts);
      return { ok: true, message: "Article saved." };
    }
    const base = slugify(data.title);
    let created = 0;
    for (let n = 1; !created; n++) {
      try {
        const [row] = await db
          .insert(posts)
          .values({ ...values, slug: n === 1 ? base : `${base}-${n}` })
          .$returningId();
        created = row.id;
      } catch (error) {
        if (!isDuplicateEntry(error) || n > 50) throw error;
      }
    }
    updateTag(TAGS.posts);
    redirect(`/admin/blog/${created}?created=1`);
  });
}

export async function deletePost(postId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const [old] = await db.select().from(posts).where(eq(posts.id, id.parse(postId)));
    if (old) {
      await db.delete(posts).where(eq(posts.id, old.id));
      await deleteImage(old.coverImage);
    }
    updateTag(TAGS.posts);
    redirect("/admin/blog");
  });
}

// ---------- Data ----------

export async function backupNow(): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    try {
      const name = await createBackup();
      return { ok: true, message: `Backup ${name} created.` };
    } catch (error) {
      console.error(error);
      throw new UserError(error instanceof Error ? error.message : "The backup failed.");
    }
  });
}

/** Old calendar subscription links stop working straight away. */
export async function resetCalendarLinks(): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    await writeSettings({ calendarNonce: newNonce() });
    updateTag(TAGS.settings);
    return { ok: true, message: "New links created. Subscribe again with the new ones." };
  });
}

export async function syncSubscribers(): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const { synced, total } = await syncAllSubscribers();
    return { ok: synced === total, message: `Sent ${synced} of ${total} subscribers to Resend.` };
  });
}
