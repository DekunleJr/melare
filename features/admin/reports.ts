import "server-only";
import { and, count, desc, eq, gte, inArray, lt, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { bookings, orderItems, orders, payments, refunds } from "@/db/schema";
import { PAID_ORDER_STATUSES } from "@/features/orders/service";
import { addDaysToKey, dateKey, dayRange, formatShortDate } from "@/lib/time";

export type Period = { from: string; to: string };

const asDate = (key: string) => formatShortDate(new Date(`${key}T12:00:00Z`));

/** Money and activity between two salon-local days, inclusive. */
export async function salesReport({ from, to }: Period) {
  const start = dayRange(from).start;
  const end = dayRange(to).end;

  const received = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.status, "completed"),
        gte(payments.completedAt, start),
        lt(payments.completedAt, end),
      ),
    );
  const returned = await db
    .select({ refund: refunds, method: payments.method })
    .from(refunds)
    .innerJoin(payments, eq(payments.id, refunds.paymentId))
    .where(and(gte(refunds.createdAt, start), lt(refunds.createdAt, end)));

  // Group by day, week or month so the chart stays readable.
  const days: string[] = [];
  for (let key = from; key <= to && days.length < 1100; key = addDaysToKey(key, 1)) days.push(key);
  const unit = days.length <= 62 ? "day" : days.length <= 370 ? "week" : "month";
  const bucketOf = (key: string) =>
    unit === "day"
      ? key
      : unit === "month"
        ? key.slice(0, 7)
        : days[Math.floor(days.indexOf(key) / 7) * 7];
  const buckets = new Map<string, number>();
  for (const key of days) buckets.set(bucketOf(key), 0);
  const add = (date: Date, pence: number) => {
    const bucket = bucketOf(dateKey(date));
    if (buckets.has(bucket)) buckets.set(bucket, buckets.get(bucket)! + pence);
  };
  for (const p of received) add(p.completedAt!, p.amountPence);
  for (const r of returned) add(r.refund.createdAt, -r.refund.amountPence);

  const monthName = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const series = [...buckets].map(([key, pence]) => ({
    label:
      unit === "day"
        ? asDate(key)
        : unit === "week"
          ? `Week of ${asDate(key)}`
          : monthName.format(new Date(`${key}-01T00:00:00Z`)),
    pence,
  }));

  const total = (list: number[]) => list.reduce((n, v) => n + v, 0);
  const grossPence = total(received.map((p) => p.amountPence));
  const refundedPence = total(returned.map((r) => r.refund.amountPence));
  const byMethod = new Map<string, number>();
  for (const p of received) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amountPence);
  for (const r of returned) {
    byMethod.set(r.method, (byMethod.get(r.method) ?? 0) - r.refund.amountPence);
  }

  const sold = and(
    inArray(orders.status, PAID_ORDER_STATUSES),
    gte(orders.paidAt, start),
    lt(orders.paidAt, end),
  );
  const bestSellers = await db
    .select({
      name: orderItems.name,
      option: orderItems.variantLabel,
      units: sum(orderItems.quantity),
      value: sum(sql`${orderItems.unitPricePence} * ${orderItems.quantity}`),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(sold)
    .groupBy(orderItems.name, orderItems.variantLabel)
    .orderBy(desc(sum(orderItems.quantity)))
    .limit(10);
  const [orderCount] = await db.select({ total: count() }).from(orders).where(sold);

  const kept = and(
    inArray(bookings.status, ["confirmed", "completed"]),
    gte(bookings.startsAt, start),
    lt(bookings.startsAt, end),
  );
  const popular = await db
    .select({ name: bookings.serviceName, total: count(), value: sum(bookings.totalPence) })
    .from(bookings)
    .where(kept)
    .groupBy(bookings.serviceName)
    .orderBy(desc(count()))
    .limit(10);
  const outcomes = await db
    .select({ status: bookings.status, total: count() })
    .from(bookings)
    .where(and(gte(bookings.startsAt, start), lt(bookings.startsAt, end)))
    .groupBy(bookings.status);
  const outcome = (status: string) => outcomes.find((o) => o.status === status)?.total ?? 0;

  return {
    unit,
    series,
    grossPence,
    refundedPence,
    netPence: grossPence - refundedPence,
    productPence:
      total(received.map((p) => p.orderPence)) - total(returned.map((r) => r.refund.orderPence)),
    appointmentPence:
      total(received.map((p) => p.bookingPence)) -
      total(returned.map((r) => r.refund.bookingPence)),
    byMethod: [...byMethod],
    orders: orderCount.total,
    appointments: outcome("confirmed") + outcome("completed"),
    cancelled: outcome("cancelled"),
    noShows: outcome("no_show"),
    bestSellers: bestSellers.map((b) => ({
      ...b,
      units: Number(b.units ?? 0),
      value: Number(b.value ?? 0),
    })),
    popular: popular.map((p) => ({ ...p, value: Number(p.value ?? 0) })),
  };
}
