import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { bookings, orderItems, orders, payments, refunds, subscribers, user } from "@/db/schema";
import { groupBy } from "@/db/relations";
import { penceToInput } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { dayRange, isDateKey } from "@/lib/time";
import { manageUrl } from "@/lib/tokens";

type Cell = string | number | Date | null;

/** Quote every cell and neutralise values a spreadsheet would run as a formula. */
const cell = (value: Cell) => {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

const money = penceToInput;

async function table(kind: string, params: URLSearchParams): Promise<Cell[][] | null> {
  if (kind === "subscribers") {
    const rows = await db.select().from(subscribers).orderBy(asc(subscribers.createdAt));
    return [
      ["email", "joined", "unsubscribe_link"],
      ...rows.map((r) => [r.email, r.createdAt, manageUrl("unsubscribe", r)]),
    ];
  }
  if (kind === "orders") {
    const rows = await db.select().from(orders).orderBy(asc(orders.createdAt));
    const items = groupBy(await db.select().from(orderItems), (i) => i.orderId);
    return [
      ["order", "created", "status", "name", "email", "phone", "method", "address", "items", "subtotal", "delivery", "discount", "total", "refunded"],
      ...rows.map((o) => [
        o.number,
        o.createdAt,
        o.status,
        o.customerName,
        o.customerEmail,
        o.customerPhone,
        o.deliveryMethodName || o.fulfilment,
        [o.addressLine1, o.addressLine2, o.city, o.postcode].filter(Boolean).join(", "),
        (items.get(o.id) ?? [])
          .map((i) => `${i.quantity} x ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""}`)
          .join("; "),
        money(o.subtotalPence),
        money(o.deliveryPence),
        money(o.discountPence),
        money(o.totalPence),
        money(o.refundedPence),
      ]),
    ];
  }
  if (kind === "bookings") {
    const rows = await db.select().from(bookings).orderBy(asc(bookings.startsAt));
    return [
      ["booking", "starts", "ends", "status", "service", "staff", "location", "postcode", "name", "email", "phone", "total", "paid", "refunded", "notes"],
      ...rows.map((b) => [
        b.reference,
        b.startsAt,
        b.endsAt,
        b.status,
        b.serviceName,
        b.staffName,
        b.locationType,
        b.postcode,
        b.customerName,
        b.customerEmail,
        b.customerPhone,
        money(b.totalPence),
        money(b.paidPence),
        money(b.refundedPence),
        b.notes,
      ]),
    ];
  }
  if (kind === "payments") {
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    const rows = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.status, "completed"),
          isDateKey(from) ? gte(payments.completedAt, dayRange(from).start) : undefined,
          isDateKey(to) ? lt(payments.completedAt, dayRange(to).end) : undefined,
        ),
      )
      .orderBy(asc(payments.completedAt));
    const back = groupBy(await db.select().from(refunds), (r) => r.paymentId);
    return [
      ["payment", "date", "method", "transaction", "amount", "products", "appointment", "refunded", "order_id", "booking_id"],
      ...rows.map((p) => [
        p.reference,
        p.completedAt,
        p.method,
        p.captureId,
        money(p.amountPence),
        money(p.orderPence),
        money(p.bookingPence),
        money((back.get(p.id) ?? []).reduce((n, r) => n + r.amountPence, 0)),
        p.orderId,
        p.bookingId,
      ]),
    ];
  }
  if (kind === "customers") {
    const accounts = await db.select().from(user);
    const placed = await db.select().from(orders);
    const booked = await db.select().from(bookings);
    type Customer = { name: string; phone: string; account: boolean; orders: number; bookings: number };
    const people = new Map<string, Customer>();
    const person = (email: string, name: string, phone = "") => {
      const key = email.toLowerCase();
      const found = people.get(key) ?? { name, phone, account: false, orders: 0, bookings: 0 };
      found.phone ||= phone;
      people.set(key, found);
      return found;
    };
    for (const a of accounts) person(a.email, a.name).account = true;
    for (const o of placed) {
      if (o.paidAt) person(o.customerEmail, o.customerName, o.customerPhone).orders++;
    }
    for (const b of booked) {
      if (!["expired", "declined"].includes(b.status)) {
        person(b.customerEmail, b.customerName, b.customerPhone).bookings++;
      }
    }
    return [
      ["email", "name", "phone", "has_account", "paid_orders", "bookings"],
      ...[...people]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([email, c]) => [email, c.name, c.phone, c.account ? "yes" : "no", c.orders, c.bookings]),
    ];
  }
  return null;
}

export async function GET(request: Request, ctx: RouteContext<"/api/admin/export/[kind]">) {
  await requireAdmin();
  const { kind } = await ctx.params;
  const rows = await table(kind, new URL(request.url).searchParams);
  if (!rows) return new Response("Not found", { status: 404 });
  return new Response(rows.map((row) => row.map(cell).join(",")).join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
