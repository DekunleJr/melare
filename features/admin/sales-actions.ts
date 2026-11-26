"use server";

import { and, eq } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { bookings, orderStatuses } from "@/db/schema/sales";
import { getBooking, rescheduleBooking } from "@/features/bookings/service";
import {
  approveBooking,
  cancelBooking,
  createCheckout,
  declineBooking,
} from "@/features/checkout/service";
import { notifyBalanceRequest, notifyBooking, notifyOrder } from "@/features/notifications";
import {
  cancelPaidOrder,
  getOrder,
  releaseOrder,
  updateOrderStatus,
} from "@/features/orders/service";
import {
  balancePayment,
  closePayment,
  paymentsFor,
  recordManualPayment,
} from "@/features/payments/ledger";
import { refundableAmount, refundTarget } from "@/features/payments/process";
import { formObject, runAction } from "@/lib/actions";
import { UserError } from "@/lib/errors";
import type { FormState } from "@/lib/forms";
import { formatPence } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { TAGS } from "@/lib/tags";
import { parseLocalDateTime } from "@/lib/time";
import { manageUrl } from "@/lib/tokens";
import { contactDetails, id, money, optionalText } from "@/lib/validation";

type Target = { orderId: number } | { bookingId: number };

/** Refund and describe what happened, including money that must be handed back. */
async function refundAndReport(target: Target, amount: number, note: string) {
  try {
    const { paypalPence, manualPence } = await refundTarget(target, amount, note);
    if ("orderId" in target) after(() => notifyOrder(target.orderId, "refund"));
    return {
      ok: true,
      message: [
        paypalPence ? `Refunded ${formatPence(paypalPence)} through PayPal.` : "",
        manualPence
          ? `Recorded ${formatPence(manualPence)} as refunded: return it yourself (cash, card reader, bank or Stripe).`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    };
  } catch (error) {
    if (error instanceof UserError) return { ok: false, message: error.message };
    console.error("Refund failed", error);
    return {
      ok: false,
      message: "The refund failed. Check your PayPal settings and try again, or refund in PayPal.",
    };
  }
}

// ---------- Orders ----------

export async function setOrderStatus(
  orderId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const data = z
      .object({ status: z.enum(orderStatuses), trackingInfo: optionalText(255) })
      .parse(formObject(formData));
    const target = id.parse(orderId);
    const changed = await updateOrderStatus(target, data.status, data.trackingInfo);
    if (changed) after(() => notifyOrder(target, "status"));
    return { ok: true, message: changed ? "Updated and the customer was emailed." : "Saved." };
  });
}

export async function cancelAndRefundOrder(
  orderId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const target = id.parse(orderId);
    await cancelPaidOrder(target, formData.get("restock") === "on");
    updateTag(TAGS.products);
    const amount = await refundableAmount({ orderId: target });
    if (!amount) return { ok: true, message: "Order cancelled. There was nothing to refund." };
    const result = await refundAndReport({ orderId: target }, amount, "Order cancelled");
    if (!result.ok) refresh();
    return { ok: result.ok, message: `Order cancelled. ${result.message}` };
  });
}

const refundSchema = z.object({ amount: money, note: optionalText(200) });

/** A full or partial refund without changing the order's progress. */
export async function refundOrderAmount(
  orderId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const data = refundSchema.parse(formObject(formData));
    const result = await refundAndReport({ orderId: id.parse(orderId) }, data.amount, data.note);
    updateTag(TAGS.products);
    return result;
  });
}

export async function cancelPendingOrder(orderId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const order = await getOrder(id.parse(orderId));
    if (!order || order.status !== "pending") throw new UserError("This order is no longer pending.");
    if (order.bookingId) {
      throw new UserError("This order belongs to an unpaid booking. Cancel the booking instead.");
    }
    const waiting = await paymentsFor({ orderId: order.id });
    if (waiting.some((p) => p.status === "capturing" || p.status === "processing")) {
      throw new UserError("A payment is being processed. Try again in a few minutes.");
    }
    for (const p of waiting.filter((p) => p.status === "pending")) {
      await closePayment(p.id, "cancelled");
    }
    await releaseOrder(order.id, "cancelled");
    updateTag(TAGS.products);
    return { ok: true, message: "Order cancelled and stock released." };
  });
}

// ---------- Bookings ----------

export async function createManualBooking(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const data = z
      .object({
        ...contactDetails,
        serviceId: id,
        staffId: z.coerce.number().int().min(0),
        start: z.string(),
        locationType: z.enum(["salon", "mobile"]),
        addressLine1: optionalText(200),
        city: optionalText(100),
        postcode: optionalText(20),
        notes: optionalText(500),
      })
      .parse(formObject(formData));
    const start = parseLocalDateTime(data.start);
    if (!start) throw new UserError("Choose a valid date and time.");
    const { bookingId } = await createCheckout({
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      discountCode: "",
      userId: null,
      source: "admin",
      booking: {
        serviceId: data.serviceId,
        staffId: data.staffId || null,
        start,
        locationType: data.locationType,
        addonIds: [],
        notes: data.notes,
        images: [],
        addressLine1: data.addressLine1,
        addressLine2: "",
        city: data.city,
        postcode: data.postcode,
      },
    });
    if (formData.get("notify") === "on") after(() => notifyBooking(bookingId!, "confirmed"));
    redirect(`/admin/bookings/${bookingId}`);
  });
}

export async function approveRequest(bookingId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const target = id.parse(bookingId);
    const { payment } = await approveBooking(target);
    if (payment) {
      after(() =>
        notifyBooking(target, "approved", {
          payUrl: manageUrl("payment", payment),
          payBy: payment.expiresAt ?? undefined,
        }),
      );
      return { ok: true, message: "Approved. The customer has been emailed a payment link." };
    }
    after(() => notifyBooking(target, "confirmed"));
    return { ok: true, message: "Approved and confirmed. The customer has been emailed." };
  });
}

export async function declineRequest(bookingId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const target = id.parse(bookingId);
    await declineBooking(target);
    updateTag(TAGS.products);
    after(() => notifyBooking(target, "declined"));
    return { ok: true, message: "Declined. The customer has been emailed." };
  });
}

export async function setBookingOutcome(
  bookingId: number,
  outcome: "completed" | "no_show",
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const status = z.enum(["completed", "no_show"]).parse(outcome);
    const booking = await getBooking(id.parse(bookingId));
    if (!booking || booking.status !== "confirmed") {
      throw new UserError("Only confirmed bookings can be updated.");
    }
    if (booking.startsAt > new Date()) {
      throw new UserError("This appointment has not started yet.");
    }
    await db
      .update(bookings)
      .set({ status })
      .where(and(eq(bookings.id, booking.id), eq(bookings.status, "confirmed")));
    return { ok: true, message: "Booking updated." };
  });
}

export async function adminCancelBooking(
  bookingId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const target = id.parse(bookingId);
    await cancelBooking(target, "admin");
    updateTag(TAGS.products);
    let result = { ok: true, message: "" };
    const amount = await refundableAmount({ bookingId: target });
    if (formData.get("refund") === "on" && amount > 0) {
      result = await refundAndReport({ bookingId: target }, amount, "Cancelled by the salon");
    }
    after(() => notifyBooking(target, "cancelled"));
    if (!result.ok) refresh();
    return { ok: result.ok, message: `Booking cancelled. ${result.message}` };
  });
}

export async function refundBookingAmount(
  bookingId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const data = refundSchema.parse(formObject(formData));
    return refundAndReport({ bookingId: id.parse(bookingId) }, data.amount, data.note);
  });
}

export async function recordBookingPayment(
  bookingId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const data = z
      .object({
        amount: money,
        method: z.enum(["cash", "card_in_salon", "bank_transfer"]),
        note: optionalText(200),
      })
      .parse(formObject(formData));
    await recordManualPayment(id.parse(bookingId), data.amount, data.method, data.note);
    return { ok: true, message: `Recorded ${formatPence(data.amount)}.` };
  });
}

export async function sendBalanceRequest(bookingId: number): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const payment = await balancePayment(id.parse(bookingId));
    after(() => notifyBalanceRequest(payment.id));
    return { ok: true, message: `Payment link for ${formatPence(payment.amountPence)} emailed.` };
  });
}

export async function adminReschedule(
  bookingId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  return runAction(async () => {
    const start = parseLocalDateTime(String(formData.get("start")));
    if (!start) throw new UserError("Choose a valid date and time.");
    const target = id.parse(bookingId);
    await rescheduleBooking(target, start, "admin");
    after(() => notifyBooking(target, "rescheduled"));
    return { ok: true, message: "Moved and the customer was emailed." };
  });
}
