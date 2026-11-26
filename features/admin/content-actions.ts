"use server";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  contactMessages,
  faqs,
  galleryImages,
  reviews,
  session,
  subscribers,
  user,
} from "@/db/schema";
import { removeSubscriberByEmail } from "@/features/marketing";
import { formObject, runAction } from "@/lib/actions";
import { resendEmail } from "@/lib/email/send";
import { UserError } from "@/lib/errors";
import type { FormState } from "@/lib/forms";
import { requireAdmin } from "@/lib/session";
import { readSettings, writeSettings } from "@/lib/settings";
import { deleteImage, saveImage } from "@/lib/storage";
import { TAGS } from "@/lib/tags";
import {
  checkbox,
  email,
  id,
  optionalText,
  requiredText,
  wholeNumber,
} from "@/lib/validation";

// ---------- Reviews ----------

export async function moderateReview(
  reviewId: number,
  decision: "approved" | "rejected" | "delete",
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const target = id.parse(reviewId);
    const choice = z.enum(["approved", "rejected", "delete"]).parse(decision);
    if (choice === "delete") await db.delete(reviews).where(eq(reviews.id, target));
    else await db.update(reviews).set({ status: choice }).where(eq(reviews.id, target));
    updateTag(TAGS.reviews);
    return { ok: true };
  });
}

// ---------- Gallery ----------

export async function addGalleryImages(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const caption = optionalText(200).parse(formData.get("caption") ?? "");
    let added = 0;
    for (const file of formData.getAll("images").slice(0, 6)) {
      const path = await saveImage(file);
      if (!path) continue;
      await db.insert(galleryImages).values({ path, caption });
      added++;
    }
    if (!added) throw new UserError("Choose at least one image.");
    updateTag(TAGS.gallery);
    return { ok: true, message: `Added ${added} image(s).` };
  });
}

export async function saveGalleryImage(
  imageId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const data = z
      .object({ caption: optionalText(200), sortOrder: wholeNumber(0, 1000) })
      .parse(formObject(formData));
    await db.update(galleryImages).set(data).where(eq(galleryImages.id, id.parse(imageId)));
    updateTag(TAGS.gallery);
    return { ok: true, message: "Saved." };
  });
}

export async function deleteGalleryImage(imageId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const target = id.parse(imageId);
    const [image] = await db.select().from(galleryImages).where(eq(galleryImages.id, target));
    await db.delete(galleryImages).where(eq(galleryImages.id, target));
    await deleteImage(image?.path);
    updateTag(TAGS.gallery);
    return { ok: true };
  });
}

// ---------- FAQs ----------

export async function saveFaq(
  faqId: number | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const data = z
      .object({
        question: requiredText(300),
        answer: requiredText(3000),
        sortOrder: wholeNumber(0, 1000),
        published: checkbox,
      })
      .parse(formObject(formData));
    if (faqId) await db.update(faqs).set(data).where(eq(faqs.id, id.parse(faqId)));
    else await db.insert(faqs).values(data);
    updateTag(TAGS.faqs);
    return { ok: true, message: "Saved." };
  });
}

export async function deleteFaq(faqId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    await db.delete(faqs).where(eq(faqs.id, id.parse(faqId)));
    updateTag(TAGS.faqs);
    return { ok: true };
  });
}

// ---------- Messages, subscribers, emails ----------

export async function setMessageStatus(
  messageId: number,
  status: "new" | "read" | "archived" | "delete",
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const target = id.parse(messageId);
    const choice = z.enum(["new", "read", "archived", "delete"]).parse(status);
    if (choice === "delete") {
      await db.delete(contactMessages).where(eq(contactMessages.id, target));
    } else {
      await db.update(contactMessages).set({ status: choice }).where(eq(contactMessages.id, target));
    }
    return { ok: true };
  });
}

export async function removeSubscriber(subscriberId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const [row] = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.id, id.parse(subscriberId)));
    if (row) await removeSubscriberByEmail(row.email);
    return { ok: true };
  });
}

export async function retryEmail(emailId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const outcome = await resendEmail(id.parse(emailId));
    return outcome.status === "failed"
      ? { message: outcome.error ?? "Sending failed." }
      : { ok: true, message: outcome.status === "sent" ? "Sent." : "Logged only (RESEND_API_KEY is not set)." };
  });
}

// ---------- Accounts ----------

export async function updateAccount(
  userId: string,
  change: "make_admin" | "make_customer" | "disable" | "enable",
): Promise<FormState> {
  const admin = await requireAdmin();
  return runAction(async () => {
    const target = requiredText(36).parse(userId);
    const choice = z.enum(["make_admin", "make_customer", "disable", "enable"]).parse(change);
    if (target === admin.id) throw new UserError("You cannot change your own access.");
    const changes = {
      make_admin: { role: "admin" as const },
      make_customer: { role: "customer" as const },
      disable: { disabled: true },
      enable: { disabled: false },
    }[choice];
    await db.update(user).set(changes).where(eq(user.id, target));
    // Sign the person out so the change takes effect immediately.
    if (choice === "disable" || choice === "make_customer") {
      await db.delete(session).where(eq(session.userId, target));
    }
    return { ok: true, message: "Account updated." };
  });
}

// ---------- Settings ----------

const optionalEmail = z.union([z.literal(""), email]);
/** A ticked box is stored as 1, an unticked one as 0. */
const toggle = checkbox.transform((on) => (on ? 1 : 0));

const settingsSchema = z.object({
  businessName: requiredText(60),
  tagline: optionalText(120),
  heroTitle: requiredText(80),
  heroSubtitle: optionalText(300),
  aboutText: optionalText(5000),
  announcement: optionalText(200),
  phone: optionalText(40),
  publicEmail: optionalEmail,
  contactEmail: optionalEmail,
  address: optionalText(300),
  openingHours: optionalText(600),
  whatsapp: optionalText(30),
  instagram: optionalText(200),
  facebook: optionalText(200),
  tiktok: optionalText(200),
  pickupEnabled: toggle,
  pickupInstructions: optionalText(500),
  mobileEnabled: toggle,
  mobileNeedsApproval: toggle,
  approvalHoldHours: wholeNumber(1, 336),
  paymentLinkHours: wholeNumber(1, 336),
  abandonedCartHours: wholeNumber(0, 168),
  backupKeep: wholeNumber(1, 365),
  gaMeasurementId: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^G-[A-Z0-9]{4,20}$/.test(v), "Looks like G-XXXXXXXXXX."),
  bookingLeadHours: wholeNumber(0, 720),
  bookingHorizonDays: wholeNumber(1, 365),
  slotIntervalMinutes: wholeNumber(5, 120),
  cancellationNoticeHours: wholeNumber(0, 720),
  cancellationPolicy: optionalText(1000),
});

export async function saveSettings(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const data = settingsSchema.parse(formObject(formData));
    const heroImage = await saveImage(formData.get("heroImage"));
    const previous = await readSettings();
    await writeSettings({ ...data, ...(heroImage ? { heroImage } : {}) });
    if (heroImage) await deleteImage(previous.heroImage);
    updateTag(TAGS.settings);
    return { ok: true, message: "Settings saved." };
  });
}
