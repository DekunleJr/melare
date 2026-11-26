"use server";

import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contactMessages, profiles, reviews, subscribers } from "@/db/schema";
import { addSubscriber, removeSubscriberByEmail } from "@/features/marketing";
import { accessBooking, accessOrder, type Access } from "@/features/access";
import { notifyContactMessage } from "@/features/notifications";
import { PAID_ORDER_STATUSES } from "@/features/orders/service";
import { formObject, runAction } from "@/lib/actions";
import { isDuplicateEntry, UserError } from "@/lib/errors";
import type { FormState } from "@/lib/forms";
import { allowRequest } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { parseTokenId, verifyToken } from "@/lib/tokens";
import { email, id, optionalText, phone, requiredText, wholeNumber } from "@/lib/validation";

async function guard(formData: FormData, action: string, limit: number) {
  if (formData.get("website")) throw new UserError("Your message could not be sent.");
  if (!(await allowRequest(action, limit, 10))) {
    throw new UserError("Too many attempts. Please wait a few minutes.");
  }
}

export async function sendContactMessage(_: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guard(formData, "contact", 5);
    const data = z
      .object({
        name: requiredText(120),
        email,
        phone: optionalText(40),
        subject: requiredText(150),
        message: requiredText(3000),
      })
      .parse(formObject(formData));
    const [{ id: messageId }] = await db.insert(contactMessages).values(data).$returningId();
    after(() => notifyContactMessage(messageId));
    return { ok: true, message: "Thank you. We will get back to you soon." };
  });
}

export async function subscribe(_: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guard(formData, "subscribe", 5);
    const data = z.object({ email }).parse(formObject(formData));
    // Same reply whether or not they were already subscribed.
    await addSubscriber(data.email);
    return { ok: true, message: "You are on the list." };
  });
}

/** The link in a marketing email. Confirmed with a button so scanners cannot trigger it. */
export async function unsubscribe(token: string): Promise<FormState> {
  return runAction(async () => {
    const row = await subscriberFor(token);
    if (row) await removeSubscriberByEmail(row.email);
    return { ok: true, message: "You have been unsubscribed." };
  });
}

async function subscriberFor(token: string) {
  const subscriberId = typeof token === "string" ? parseTokenId(token) : null;
  if (!subscriberId) return null;
  const [row] = await db.select().from(subscribers).where(eq(subscribers.id, subscriberId));
  return row && verifyToken("unsubscribe", token, row) ? row : null;
}

export async function saveProfile(_: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await requireUser("/account/profile");
    const data = z
      .object({
        phone: z.union([z.literal(""), phone]),
        addressLine1: optionalText(200),
        addressLine2: optionalText(200),
        city: optionalText(100),
        postcode: optionalText(20),
      })
      .parse(formObject(formData));
    await db
      .insert(profiles)
      .values({ userId: user.id, ...data })
      .onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
    return { ok: true, message: "Your details are saved." };
  });
}

const reviewSchema = z.object({
  rating: wholeNumber(1, 5),
  comment: requiredText(1500, "Tell us about your experience."),
});

/** Only someone who really bought the product or had the appointment can review it. */
export async function submitReview(
  target: { kind: "order"; access: Access; productId: number } | { kind: "booking"; access: Access },
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  return runAction(async () => {
    await guard(formData, "review", 10);
    const data = reviewSchema.parse(formObject(formData));
    let values: typeof reviews.$inferInsert;

    if (target.kind === "order") {
      const order = await accessOrder(target.access);
      const productId = id.parse(target.productId);
      if (
        !order ||
        !PAID_ORDER_STATUSES.includes(order.status) ||
        !order.items.some((i) => i.productId === productId)
      ) {
        throw new UserError("This item cannot be reviewed.");
      }
      const [existing] = await db
        .select({ id: reviews.id })
        .from(reviews)
        .where(and(eq(reviews.orderId, order.id), eq(reviews.productId, productId)));
      if (existing) throw new UserError("You have already reviewed this item.");
      values = {
        ...data,
        orderId: order.id,
        productId,
        userId: order.userId,
        authorName: order.customerName.split(" ")[0],
      };
    } else {
      const booking = await accessBooking(target.access);
      if (!booking || booking.status !== "completed") {
        throw new UserError("You can review a visit once it is complete.");
      }
      values = {
        ...data,
        bookingId: booking.id,
        serviceId: booking.serviceId,
        userId: booking.userId,
        authorName: booking.customerName.split(" ")[0],
      };
    }

    try {
      await db.insert(reviews).values(values);
    } catch (error) {
      if (isDuplicateEntry(error)) throw new UserError("You have already reviewed this.");
      throw error;
    }
    return { ok: true, message: "Thank you. Your review will appear once approved." };
  });
}
