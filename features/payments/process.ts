import "server-only";
import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { bookings, orders, payments, webhookEvents } from "@/db/schema";
import { getBooking } from "@/features/bookings/service";
import {
  notifyBooking,
  notifyOrder,
  notifyPayment,
  notifyRefundNeeded,
} from "@/features/notifications";
import { releaseOrder } from "@/features/orders/service";
import { isDuplicateEntry, UserError, withRetry } from "@/lib/errors";
import { formatPence } from "@/lib/money";
import { readSettings } from "@/lib/settings";
import {
  claimForCapture,
  closePayment,
  completePayment,
  getPayment,
  insertRefund,
  paymentsFor,
  releaseHeld,
  setPaymentState,
  type Payment,
} from "./ledger";
import {
  captureOf,
  capturePaypalOrder,
  createPaypalOrder,
  getPaypalOrder,
  PaypalError,
  refundCapture,
  toPence,
  type PaypalOrder,
} from "./paypal";

export type Effects = {
  /** Run slow follow-up work (emails) after the response, e.g. Next's after(). */
  defer: (task: () => Promise<unknown>) => void;
};

const payable = (p: Payment, now = new Date()) =>
  p.status === "pending" && (!p.expiresAt || p.expiresAt > now);

/** Create the PayPal order for a waiting payment. The amount comes from our records. */
export async function startPayment(id: number, source: "paypal" | "other"): Promise<string> {
  const payment = await getPayment(id);
  if (!payment || !payable(payment)) {
    throw new UserError("This payment is no longer available.");
  }
  const settings = await readSettings();
  const order = await createPaypalOrder({
    reference: payment.reference,
    description: `${settings.businessName} ${payment.reference}`,
    amountPence: payment.amountPence,
    brandName: settings.businessName,
    source,
  });
  await db
    .update(payments)
    .set({ paypalOrderId: order.id })
    .where(and(eq(payments.id, id), eq(payments.status, "pending")));
  return order.id;
}

// ---------- Refunds ----------

/** Return parts of one payment through PayPal and record it. */
async function refundThroughPaypal(
  payment: Payment,
  orderPence: number,
  bookingPence: number,
  previousRefunds: number,
  note: string,
) {
  const amount = orderPence + bookingPence;
  const refund = await refundCapture(
    payment.captureId!,
    amount,
    // Retrying the same refund cannot pay it twice.
    `refund-${payment.reference}-${previousRefunds}-${orderPence}-${bookingPence}`,
  );
  if (!["COMPLETED", "PENDING"].includes(refund.status)) {
    throw new UserError("PayPal did not accept the refund.");
  }
  await insertRefund({
    paymentId: payment.id,
    orderPence,
    bookingPence,
    providerRefundId: refund.id,
    note,
  });
}

/**
 * Refund up to `amountPence` of an order or a booking, newest payment first.
 * Cash, in-salon card and older payments cannot be returned by this site: they are
 * recorded, and `manualPence` says how much must be handed back another way.
 */
export async function refundTarget(
  target: { orderId: number } | { bookingId: number },
  amountPence: number,
  note: string,
) {
  const isOrder = "orderId" in target;
  const records = await paymentsFor(target);
  const available = records.reduce((n, p) => n + (isOrder ? p.orderLeft : p.bookingLeft), 0);
  if (amountPence < 1 || amountPence > available) {
    throw new UserError(`You can refund up to ${formatPence(available)}.`);
  }
  let remaining = amountPence;
  let paypalPence = 0;
  let manualPence = 0;
  for (const payment of records) {
    const left = isOrder ? payment.orderLeft : payment.bookingLeft;
    const part = Math.min(left, remaining);
    if (part <= 0) continue;
    const orderPence = isOrder ? part : 0;
    const bookingPence = isOrder ? 0 : part;
    if (payment.method === "paypal" && payment.captureId) {
      await refundThroughPaypal(payment, orderPence, bookingPence, payment.refunds.length, note);
      paypalPence += part;
    } else {
      await insertRefund({
        paymentId: payment.id,
        orderPence,
        bookingPence,
        providerRefundId: null,
        note,
      });
      manualPence += part;
    }
    remaining -= part;
    if (!remaining) break;
  }
  return { paypalPence, manualPence };
}

/** Everything still held for an order or booking. Zero if there is nothing to return. */
export async function refundableAmount(target: { orderId: number } | { bookingId: number }) {
  const records = await paymentsFor(target);
  return records.reduce(
    (n, p) => n + ("orderId" in target ? p.orderLeft : p.bookingLeft),
    0,
  );
}

// ---------- Taking money ----------

/** Money has been captured: confirm the purchase, or send back what cannot be honoured. */
async function settle(payment: Payment, captureId: string, effects: Effects) {
  const result = await completePayment(payment.id, { captureId });
  if (result.outcome === "already") return;
  const { orderPence, bookingPence } = result.refund;
  if (!orderPence && !bookingPence) {
    effects.defer(() => notifyPayment(payment.id));
    return;
  }
  try {
    await refundThroughPaypal(result.payment, orderPence, bookingPence, 0, "No longer available");
    if (bookingPence) effects.defer(() => notifyBooking(payment.bookingId!, "slot_lost"));
    else if (payment.bookingId) effects.defer(() => notifyBooking(payment.bookingId!, "confirmed"));
    if (orderPence) effects.defer(() => notifyOrder(payment.orderId!, "refund"));
    else if (payment.orderId) effects.defer(() => notifyOrder(payment.orderId!, "paid"));
  } catch (error) {
    console.error(`Automatic refund of ${payment.reference} failed`, error);
    effects.defer(() => notifyRefundNeeded(payment.id));
  }
}

export type CaptureResult = "completed" | "pending" | "declined" | "unavailable";

async function applyPaypalOrder(
  payment: Payment,
  order: PaypalOrder,
  effects: Effects,
): Promise<CaptureResult | null> {
  const capture = captureOf(order);
  if (!capture) return null;
  const reference = order.purchase_units?.[0]?.custom_id;
  if (
    (reference && reference !== payment.reference) ||
    capture.amount.currency_code !== "GBP" ||
    toPence(capture.amount.value) !== payment.amountPence
  ) {
    throw new Error(`PayPal capture ${capture.id} does not match payment ${payment.reference}`);
  }
  if (capture.status === "COMPLETED") {
    await settle(payment, capture.id, effects);
    return "completed";
  }
  if (capture.status === "PENDING") {
    await setPaymentState(payment.id, "capturing", "processing", capture.id);
    return "pending";
  }
  await setPaymentState(payment.id, "capturing", "pending");
  return "declined";
}

/** Take the money the customer approved in PayPal. Safe to call more than once. */
export async function capturePayment(
  id: number,
  paypalOrderId: string,
  effects: Effects,
): Promise<CaptureResult> {
  if (!(await claimForCapture(id, paypalOrderId))) {
    const current = await getPayment(id);
    if (current?.status === "completed") return "completed";
    if (current?.status === "capturing" || current?.status === "processing") return "pending";
    return "unavailable";
  }
  const payment = (await getPayment(id))!;

  let order: PaypalOrder;
  try {
    order = await capturePaypalOrder(paypalOrderId);
  } catch (error) {
    if (error instanceof PaypalError && error.issue === "INSTRUMENT_DECLINED") {
      await setPaymentState(id, "capturing", "pending");
      return "declined";
    }
    // The outcome is uncertain: ask PayPal what actually happened.
    try {
      order = await getPaypalOrder(paypalOrderId);
    } catch (lookup) {
      console.error(`Could not confirm payment ${payment.reference}`, error, lookup);
      // Left as "capturing"; the scheduled task settles it later.
      return "pending";
    }
    if (!captureOf(order)) {
      await setPaymentState(id, "capturing", "pending");
      if (error instanceof PaypalError && error.status === 422) return "declined";
      throw error;
    }
  }
  const result = await applyPaypalOrder(payment, order, effects);
  if (!result) {
    await setPaymentState(id, "capturing", "pending");
    return "unavailable";
  }
  return result;
}

// ---------- Webhooks ----------

type Resource = {
  id?: string;
  status?: string;
  custom_id?: string;
  amount?: { currency_code: string; value: string };
  supplementary_data?: { related_ids?: { order_id?: string; capture_id?: string } };
  links?: { rel: string; href: string }[];
};

export type PaypalEvent = { id: string; event_type: string; resource: Resource };

async function paymentForCapture(resource: Resource) {
  const orderId = resource.supplementary_data?.related_ids?.order_id;
  if (orderId) {
    const [row] = await db.select().from(payments).where(eq(payments.paypalOrderId, orderId));
    if (row) return row;
  }
  if (resource.id) {
    const [row] = await db.select().from(payments).where(eq(payments.captureId, resource.id));
    if (row) return row;
  }
  if (resource.custom_id) {
    const [row] = await db.select().from(payments).where(eq(payments.reference, resource.custom_id));
    return row;
  }
}

async function externalRefund(resource: Resource) {
  const captureId =
    resource.links
      ?.find((l) => l.rel === "up")
      ?.href.match(/\/captures\/([A-Za-z0-9]+)/)?.[1] ??
    resource.supplementary_data?.related_ids?.capture_id;
  if (!captureId || !resource.id || !resource.amount) return;
  const [payment] = await db.select().from(payments).where(eq(payments.captureId, captureId));
  if (!payment) return;
  const [record] = await paymentsFor({ paymentId: payment.id });
  if (record.refunds.some((r) => r.providerRefundId === resource.id)) return;
  // Refunds made in PayPal come off products first, then the appointment.
  const amount = toPence(resource.amount.value);
  const orderPence = Math.min(amount, record.orderLeft);
  const bookingPence = Math.min(amount - orderPence, record.bookingLeft);
  if (!orderPence && !bookingPence) return;
  await insertRefund({
    paymentId: payment.id,
    orderPence,
    bookingPence,
    providerRefundId: resource.id,
    note: "Refunded in PayPal",
  });
}

export async function handlePaypalEvent(event: PaypalEvent, effects: Effects) {
  const [seen] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, event.id));
  if (seen) return;
  const resource = event.resource;

  switch (event.event_type) {
    case "CHECKOUT.ORDER.APPROVED": {
      // Covers a customer who approved and closed the page before we captured.
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.paypalOrderId, resource.id ?? ""));
      if (payment?.status === "pending") await capturePayment(payment.id, resource.id!, effects);
      break;
    }
    case "PAYMENT.CAPTURE.COMPLETED": {
      const payment = await paymentForCapture(resource);
      if (
        payment &&
        resource.id &&
        resource.amount &&
        toPence(resource.amount.value) === payment.amountPence
      ) {
        await settle(payment, resource.id, effects);
      }
      break;
    }
    case "PAYMENT.CAPTURE.PENDING": {
      const payment = await paymentForCapture(resource);
      if (payment) await setPaymentState(payment.id, "capturing", "processing", resource.id);
      break;
    }
    case "PAYMENT.CAPTURE.DENIED":
    case "PAYMENT.CAPTURE.DECLINED": {
      const payment = await paymentForCapture(resource);
      if (payment) await closePayment(payment.id, "failed", ["pending", "capturing", "processing"]);
      break;
    }
    case "PAYMENT.CAPTURE.REFUNDED":
    case "PAYMENT.CAPTURE.REVERSED":
      await externalRefund(resource);
      break;
  }

  // Recorded only after success, so a failed event is retried by PayPal.
  try {
    await db.insert(webhookEvents).values({ id: event.id, type: event.event_type });
  } catch (error) {
    if (!isDuplicateEntry(error)) throw error;
  }
}

// ---------- Clean-up ----------

/** Release anything left unpaid or unapproved too long, and settle uncertain payments. */
export async function releaseStale(effects: Effects, now = new Date()) {
  let released = 0;
  const grace = new Date(now.getTime() - 2 * 60_000);
  const attempt = async (work: () => Promise<boolean>) => {
    try {
      if (await work()) released += 1;
    } catch (error) {
      console.error("Could not clean up an unfinished checkout", error);
    }
  };

  const stuck = await db
    .select()
    .from(payments)
    .where(
      and(
        inArray(payments.status, ["capturing", "processing"]),
        lt(payments.updatedAt, new Date(now.getTime() - 10 * 60_000)),
        isNotNull(payments.paypalOrderId),
      ),
    )
    .limit(50);
  for (const payment of stuck) {
    await attempt(async () => {
      const order = await getPaypalOrder(payment.paypalOrderId!);
      const capture = captureOf(order);
      if (capture?.status === "COMPLETED") await settle(payment, capture.id, effects);
      else if (!capture) await setPaymentState(payment.id, "capturing", "pending");
      return false;
    });
  }

  const unpaid = await db
    .select()
    .from(payments)
    .where(and(eq(payments.status, "pending"), lt(payments.expiresAt, grace)))
    .limit(100);
  for (const payment of unpaid) await attempt(() => closePayment(payment.id, "expired"));

  const unanswered = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.status, "requested"), lt(bookings.holdExpiresAt, now)))
    .limit(100);
  for (const { id } of unanswered) {
    await attempt(async () => {
      const [order] = await db.select().from(orders).where(eq(orders.bookingId, id));
      await withRetry(() =>
        db.transaction((tx) =>
          releaseHeld(tx, { bookingId: id, orderId: order?.id ?? null }, "expired"),
        ),
      );
      if ((await getBooking(id))?.status !== "expired") return false;
      effects.defer(() => notifyBooking(id, "request_expired"));
      return true;
    });
  }

  // Safety net for anything whose payment has already gone.
  const orphans = await db
    .select({ id: orders.id, bookingId: orders.bookingId })
    .from(orders)
    .where(and(eq(orders.status, "pending"), lt(orders.expiresAt, grace)))
    .limit(100);
  for (const order of orphans) {
    const active = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.orderId, order.id),
          inArray(payments.status, ["pending", "capturing", "processing"]),
        ),
      );
    if (!active.length) await attempt(() => releaseOrder(order.id, "expired"));
  }
  return released;
}
