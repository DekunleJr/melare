import "server-only";
import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { bookings, orders, payments, refunds } from "@/db/schema";
import { lockBooking } from "@/features/bookings/service";
import {
  lockOrder,
  releaseOrderTx,
  returnDiscountUse,
  returnStock,
} from "@/features/orders/service";
import { isDuplicateEntry, UserError, withRetry } from "@/lib/errors";
import { newNonce, newReference } from "@/lib/tokens";

/*
 * Every payment and refund is recorded here. Booking and order "paid" and
 * "refunded" figures are always recalculated from these records.
 * Nothing in this file talks to PayPal.
 */
export type Payment = typeof payments.$inferSelect;
export type Method = Payment["method"];

export async function getPayment(id: number) {
  const [row] = await db.select().from(payments).where(eq(payments.id, id));
  return row;
}

export async function insertPayment(
  tx: Tx,
  values: {
    userId: string | null;
    orderId: number | null;
    bookingId: number | null;
    orderPence: number;
    bookingPence: number;
    purpose?: "checkout" | "balance";
    expiresAt: Date | null;
  },
): Promise<Payment> {
  const [{ id }] = await tx
    .insert(payments)
    .values({
      ...values,
      reference: newReference("PY"),
      amountPence: values.orderPence + values.bookingPence,
      tokenNonce: newNonce(),
    })
    .$returningId();
  const [row] = await tx.select().from(payments).where(eq(payments.id, id));
  return row;
}

export async function lockPayment(tx: Tx, id: number): Promise<Payment | undefined> {
  const [row] = await tx.select().from(payments).where(eq(payments.id, id)).for("update");
  return row;
}

/** Recalculate a booking's money columns from its payments and refunds. */
export async function recomputeBooking(tx: Tx, bookingId: number) {
  const booking = await lockBooking(tx, bookingId);
  if (!booking) return;
  const [paid] = await tx
    .select({ total: sql<string>`coalesce(sum(${payments.bookingPence}), 0)` })
    .from(payments)
    .where(and(eq(payments.bookingId, bookingId), eq(payments.status, "completed")));
  const [back] = await tx
    .select({ total: sql<string>`coalesce(sum(${refunds.bookingPence}), 0)` })
    .from(refunds)
    .innerJoin(payments, eq(payments.id, refunds.paymentId))
    .where(eq(payments.bookingId, bookingId));
  const paidPence = Number(paid.total);
  const refundedPence = Number(back.total);
  const paymentStatus =
    refundedPence > 0
      ? refundedPence >= paidPence
        ? "refunded"
        : "partially_refunded"
      : paidPence > 0
        ? "paid"
        : booking.amountDuePence > 0
          ? "unpaid"
          : "not_required";
  await tx
    .update(bookings)
    .set({ paidPence, refundedPence, paymentStatus })
    .where(eq(bookings.id, bookingId));
}

export async function recomputeOrder(tx: Tx, orderId: number) {
  const order = await lockOrder(tx, orderId);
  if (!order) return;
  const [back] = await tx
    .select({ total: sql<string>`coalesce(sum(${refunds.orderPence}), 0)` })
    .from(refunds)
    .innerJoin(payments, eq(payments.id, refunds.paymentId))
    .where(eq(payments.orderId, orderId));
  const refundedPence = Number(back.total);
  const full = refundedPence > 0 && refundedPence >= order.totalPence;
  // A full refund of something not yet sent also returns its stock.
  if (full && ["paid", "processing", "ready_for_pickup"].includes(order.status)) {
    await returnStock(tx, order);
  }
  const wasPaid = order.paidAt !== null;
  await tx
    .update(orders)
    .set({ refundedPence, ...(full && wasPaid ? { status: "refunded" as const } : {}) })
    .where(eq(orders.id, orderId));
}

/** Close whatever an unpaid checkout was holding: appointment slot, stock, discount use. */
export async function releaseHeld(
  tx: Tx,
  held: { bookingId: number | null; orderId: number | null },
  status: "expired" | "cancelled",
) {
  if (held.bookingId) {
    const booking = await lockBooking(tx, held.bookingId);
    if (booking && ["requested", "pending_payment"].includes(booking.status)) {
      await returnDiscountUse(tx, booking.discountCodeId);
      await tx
        .update(bookings)
        .set({
          status,
          holdExpiresAt: null,
          discountCodeId: null,
          ...(status === "cancelled" ? { cancelledAt: new Date() } : {}),
        })
        .where(eq(bookings.id, booking.id));
    }
  }
  if (held.orderId) await releaseOrderTx(tx, held.orderId, status);
}

/**
 * Give up on an unpaid payment. For a checkout this also releases what it held.
 * Does nothing if the payment is no longer waiting.
 */
export async function closePayment(
  id: number,
  status: "expired" | "cancelled" | "failed",
  from: Payment["status"][] = ["pending"],
) {
  return withRetry(() =>
    db.transaction(async (tx) => {
      const payment = await lockPayment(tx, id);
      if (!payment || !from.includes(payment.status)) return false;
      await tx.update(payments).set({ status }).where(eq(payments.id, id));
      if (payment.purpose === "checkout") {
        await releaseHeld(tx, payment, status === "cancelled" ? "cancelled" : "expired");
      }
      return true;
    }),
  );
}

/**
 * Reserve the right to take the money. Only one request can win, and only while
 * the payment is still wanted, so money is never taken for something released.
 */
export async function claimForCapture(id: number, paypalOrderId: string, now = new Date()) {
  const [result] = await db
    .update(payments)
    .set({ status: "capturing" })
    .where(
      and(
        eq(payments.id, id),
        eq(payments.status, "pending"),
        eq(payments.paypalOrderId, paypalOrderId),
        or(isNull(payments.expiresAt), gt(payments.expiresAt, now)),
      ),
    );
  return result.affectedRows === 1;
}

export async function setPaymentState(
  id: number,
  from: Payment["status"],
  to: Payment["status"],
  captureId?: string,
) {
  await db
    .update(payments)
    .set({ status: to, ...(captureId ? { captureId } : {}) })
    .where(and(eq(payments.id, id), eq(payments.status, from)));
}

export type Completion =
  | { outcome: "already" }
  | {
      outcome: "completed";
      payment: Payment;
      /** Parts that arrived too late to honour and must be returned */
      refund: { orderPence: number; bookingPence: number };
    };

/** Record money received and confirm what it paid for. Idempotent. */
export async function completePayment(
  id: number,
  received: { captureId: string },
  now = new Date(),
): Promise<Completion> {
  return withRetry(() =>
    db.transaction(async (tx) => {
      const payment = await lockPayment(tx, id);
      if (!payment) throw new Error(`Money received for unknown payment ${id}`);
      if (payment.status === "completed") return { outcome: "already" as const };

      await tx
        .update(payments)
        .set({ status: "completed", captureId: received.captureId, completedAt: now, expiresAt: null })
        .where(eq(payments.id, id));

      const refund = { orderPence: 0, bookingPence: 0 };
      if (payment.bookingId) {
        const booking = await lockBooking(tx, payment.bookingId);
        if (booking?.status === "pending_payment" && payment.purpose === "checkout") {
          await tx
            .update(bookings)
            .set({ status: "confirmed", holdExpiresAt: null })
            .where(eq(bookings.id, booking.id));
        } else if (
          !booking ||
          !(payment.purpose === "balance"
            ? ["confirmed", "completed", "no_show"]
            : ["confirmed"]
          ).includes(booking.status)
        ) {
          refund.bookingPence = payment.bookingPence;
        }
      }
      if (payment.orderId) {
        const order = await lockOrder(tx, payment.orderId);
        if (order?.status === "pending" && order.stockReserved) {
          await tx
            .update(orders)
            .set({ status: "paid", paidAt: now, expiresAt: null })
            .where(eq(orders.id, order.id));
        } else {
          refund.orderPence = payment.orderPence;
          if (order && !order.paidAt) {
            await tx.update(orders).set({ paidAt: now }).where(eq(orders.id, order.id));
          }
        }
      }
      if (payment.bookingId) await recomputeBooking(tx, payment.bookingId);
      return { outcome: "completed" as const, payment: { ...payment, ...received }, refund };
    }),
  );
}

export async function insertRefund(values: {
  paymentId: number;
  orderPence: number;
  bookingPence: number;
  providerRefundId: string | null;
  note: string;
}): Promise<boolean> {
  const payment = await getPayment(values.paymentId);
  if (!payment) return false;
  try {
    await withRetry(() =>
      db.transaction(async (tx) => {
        await lockPayment(tx, payment.id);
        await tx
          .insert(refunds)
          .values({ ...values, amountPence: values.orderPence + values.bookingPence });
        if (payment.bookingId) await recomputeBooking(tx, payment.bookingId);
        if (payment.orderId) await recomputeOrder(tx, payment.orderId);
      }),
    );
    return true;
  } catch (error) {
    // The same refund reported twice counts once.
    if (isDuplicateEntry(error)) return false;
    throw error;
  }
}

export type PaymentWithRefunds = Payment & {
  refunds: (typeof refunds.$inferSelect)[];
  /** Still held after refunds, for the order and the booking */
  orderLeft: number;
  bookingLeft: number;
};

export async function paymentsFor(
  target: { orderId?: number; bookingId?: number; userId?: string; paymentId?: number },
): Promise<PaymentWithRefunds[]> {
  const rows = await db
    .select()
    .from(payments)
    .where(
      and(
        target.orderId ? eq(payments.orderId, target.orderId) : undefined,
        target.bookingId ? eq(payments.bookingId, target.bookingId) : undefined,
        target.userId ? eq(payments.userId, target.userId) : undefined,
        target.paymentId ? eq(payments.id, target.paymentId) : undefined,
      ),
    )
    .orderBy(desc(payments.createdAt), desc(payments.id));
  if (!rows.length) return [];
  const back = await db
    .select()
    .from(refunds)
    .where(inArray(refunds.paymentId, rows.map((r) => r.id)))
    .orderBy(asc(refunds.id));
  return rows.map((payment) => {
    const mine = back.filter((r) => r.paymentId === payment.id);
    const done = payment.status === "completed";
    const sum = (key: "orderPence" | "bookingPence") => mine.reduce((n, r) => n + r[key], 0);
    return {
      ...payment,
      refunds: mine,
      orderLeft: done ? payment.orderPence - sum("orderPence") : 0,
      bookingLeft: done ? payment.bookingPence - sum("bookingPence") : 0,
    };
  });
}

/**
 * What is still owed for an appointment. Money refunded is not asked for again:
 * a refund is the salon giving something back, not the customer falling behind.
 */
export function balanceDue(b: { status: string; totalPence: number; paidPence: number }): number {
  if (!["confirmed", "completed", "no_show"].includes(b.status)) return 0;
  return Math.max(0, b.totalPence - b.paidPence);
}

/** Money taken in the salon (cash, card reader, bank transfer). */
export async function recordManualPayment(
  bookingId: number,
  amountPence: number,
  method: Exclude<Method, "paypal" | "legacy">,
  note: string,
  now = new Date(),
) {
  await db.transaction(async (tx) => {
    const booking = await lockBooking(tx, bookingId);
    if (!booking) throw new UserError("Booking not found.");
    const owed = balanceDue(booking);
    if (amountPence < 1 || amountPence > owed) {
      throw new UserError("The amount must be more than zero and no more than the balance due.");
    }
    const payment = await insertPayment(tx, {
      userId: booking.userId,
      orderId: null,
      bookingId,
      orderPence: 0,
      bookingPence: amountPence,
      purpose: "balance",
      expiresAt: null,
    });
    await tx
      .update(payments)
      .set({ method, note, status: "completed", completedAt: now })
      .where(eq(payments.id, payment.id));
    // Any unpaid online request for the same money is now out of date.
    await tx
      .update(payments)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(payments.bookingId, bookingId),
          eq(payments.purpose, "balance"),
          eq(payments.status, "pending"),
        ),
      );
    await recomputeBooking(tx, bookingId);
  });
}

export const BALANCE_LINK_DAYS = 7;

/** A payment link for the outstanding balance; reuses one that still matches. */
export async function balancePayment(bookingId: number, now = new Date()): Promise<Payment> {
  return db.transaction(async (tx) => {
    const booking = await lockBooking(tx, bookingId);
    if (!booking) throw new UserError("Booking not found.");
    const owed = balanceDue(booking);
    if (!owed) throw new UserError("There is nothing left to pay on this booking.");
    const waiting = await tx
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.bookingId, bookingId),
          eq(payments.purpose, "balance"),
          inArray(payments.status, ["pending", "capturing", "processing"]),
        ),
      );
    if (waiting.some((p) => p.status !== "pending")) {
      throw new UserError("A payment for this booking is already being processed.");
    }
    const expiresAt = new Date(now.getTime() + BALANCE_LINK_DAYS * 86_400_000);
    const current = waiting.find((p) => p.bookingPence === owed && p.expiresAt! > now);
    if (current) return current;
    for (const old of waiting) {
      await tx.update(payments).set({ status: "cancelled" }).where(eq(payments.id, old.id));
    }
    return insertPayment(tx, {
      userId: booking.userId,
      orderId: null,
      bookingId,
      orderPence: 0,
      bookingPence: owed,
      purpose: "balance",
      expiresAt,
    });
  });
}
