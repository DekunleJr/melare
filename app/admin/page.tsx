import { and, asc, count, eq, gte, inArray, lt, lte, sql, sum } from "drizzle-orm";
import Link from "next/link";
import { connection } from "next/server";
import { AdminHeader, Table } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import {
  bookings,
  contactMessages,
  orders,
  payments,
  productVariants,
  products,
  refunds,
  reviews,
} from "@/db/schema";
import { isPaypalConfigured } from "@/features/payments/paypal";
import { variantLabel } from "@/features/pricing";
import { env } from "@/lib/env";
import { formatPence } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { notificationRecipient, readSettings } from "@/lib/settings";
import { dateKey, dayRange, formatDateTime, formatShortDate, formatTime } from "@/lib/time";

async function loadDashboard() {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const today = dayRange(dateKey(now));

  const [received] = await db
    .select({
      products: sum(payments.orderPence),
      appointments: sum(payments.bookingPence),
    })
    .from(payments)
    .where(and(eq(payments.status, "completed"), gte(payments.completedAt, since)));
  const [returned] = await db
    .select({
      products: sum(refunds.orderPence),
      appointments: sum(refunds.bookingPence),
    })
    .from(refunds)
    .where(gte(refunds.createdAt, since));
  const requests = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.status, "requested"), gte(bookings.holdExpiresAt, now)))
    .orderBy(asc(bookings.startsAt));
  const todays = await db
    .select()
    .from(bookings)
    .where(
      and(
        gte(bookings.startsAt, today.start),
        lt(bookings.startsAt, today.end),
        inArray(bookings.status, ["confirmed", "completed", "no_show"]),
      ),
    )
    .orderBy(asc(bookings.startsAt));
  const toFulfil = await db
    .select()
    .from(orders)
    .where(inArray(orders.status, ["paid", "processing"]))
    .orderBy(asc(orders.paidAt))
    .limit(10);
  const lowStock = await db
    .select({ variant: productVariants, product: products })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(products.status, "active"),
        eq(productVariants.active, true),
        lte(productVariants.stock, sql`${productVariants.lowStockThreshold}`),
      ),
    )
    .orderBy(asc(productVariants.stock))
    .limit(15);
  const [messages] = await db
    .select({ total: count() })
    .from(contactMessages)
    .where(eq(contactMessages.status, "new"));
  const [pendingReviews] = await db
    .select({ total: count() })
    .from(reviews)
    .where(eq(reviews.status, "pending"));

  return {
    productSales: Number(received.products ?? 0) - Number(returned.products ?? 0),
    appointmentSales: Number(received.appointments ?? 0) - Number(returned.appointments ?? 0),
    requests,
    todays,
    toFulfil,
    lowStock,
    messages: messages.total,
    pendingReviews: pendingReviews.total,
  };
}

export default async function DashboardPage() {
  await connection();
  await requireAdmin();
  const [d, settings] = await Promise.all([loadDashboard(), readSettings()]);

  const warnings = [
    !isPaypalConfigured() && "PayPal is not connected, so online payments are unavailable.",
    isPaypalConfigured() &&
      !env.paypal.webhookId &&
      "The PayPal webhook ID is missing, so some payments and refunds may not be recorded.",
    isPaypalConfigured() &&
      env.paypal.mode === "sandbox" &&
      "PayPal is in sandbox (test) mode: no real money is taken.",
    !env.resendApiKey && "Resend is not connected (RESEND_API_KEY), so no emails are being delivered.",
    env.resendApiKey &&
      env.emailFrom.includes("@resend.dev") &&
      "Emails use Resend's test sender, which only delivers to your own Resend account address. Verify your domain and change EMAIL_FROM.",
    !notificationRecipient(settings) &&
      "No contact email is set, so the salon will not be told about new bookings or orders.",
  ].filter(Boolean) as string[];

  const stats: [string, string, string][] = [
    ["Product takings, 30 days", formatPence(d.productSales), "/admin/reports"],
    ["Appointment takings, 30 days", formatPence(d.appointmentSales), "/admin/reports"],
    ["Booking requests to approve", String(d.requests.length), "/admin/bookings?status=requested"],
    ["Appointments today", String(d.todays.length), "/admin/bookings"],
    ["Orders to fulfil", String(d.toFulfil.length), "/admin/orders?status=paid"],
    ["New messages", String(d.messages), "/admin/messages"],
    ["Reviews to approve", String(d.pendingReviews), "/admin/reviews"],
  ];

  return (
    <div className="space-y-8">
      <AdminHeader title="Dashboard" />
      {warnings.length > 0 && (
        <div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          <ul className="space-y-1">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {stats.map(([name, value, href]) => (
          <li key={name}>
            <Link href={href} prefetch={false} className="card block hover:border-clay">
              <p className="text-sm text-muted">{name}</p>
              <p className="mt-1 text-3xl font-semibold">{value}</p>
            </Link>
          </li>
        ))}
      </ul>
      {d.requests.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-2xl">Waiting for your approval</h2>
          <Table head={["When", "Customer", "Service", "Where", "Reply by"]} empty="">
            {d.requests.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={`/admin/bookings/${b.id}`} prefetch={false} className="link">
                    {formatDateTime(b.startsAt)}
                  </Link>
                </td>
                <td>{b.customerName}</td>
                <td>{b.serviceName}</td>
                <td>{b.locationType === "mobile" ? b.postcode : "Salon"}</td>
                <td>{b.holdExpiresAt && formatDateTime(b.holdExpiresAt)}</td>
              </tr>
            ))}
          </Table>
        </section>
      )}
      <section>
        <h2 className="mb-3 font-display text-2xl">Today</h2>
        <Table head={["Time", "Customer", "Service", "With", "Status"]} empty="No appointments today.">
          {d.todays.map((b) => (
            <tr key={b.id}>
              <td>
                <Link href={`/admin/bookings/${b.id}`} prefetch={false} className="link">
                  {formatTime(b.startsAt)}
                </Link>
              </td>
              <td>{b.customerName}</td>
              <td>{b.serviceName}</td>
              <td>{b.staffName}</td>
              <td>
                <StatusBadge status={b.status} />
              </td>
            </tr>
          ))}
        </Table>
      </section>
      <section>
        <h2 className="mb-3 font-display text-2xl">Orders to fulfil</h2>
        <Table head={["Order", "Date", "Customer", "Method", "Total", "Status"]} empty="Nothing waiting.">
          {d.toFulfil.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={`/admin/orders/${o.id}`} prefetch={false} className="link">
                  {o.number}
                </Link>
              </td>
              <td>{formatShortDate(o.createdAt)}</td>
              <td>{o.customerName}</td>
              <td>{o.fulfilment === "delivery" ? "Delivery" : "Pickup"}</td>
              <td>{formatPence(o.totalPence)}</td>
              <td>
                <StatusBadge status={o.status} />
              </td>
            </tr>
          ))}
        </Table>
      </section>
      <section>
        <h2 className="mb-3 font-display text-2xl">Low stock</h2>
        <Table head={["Product", "In stock"]} empty="Stock levels look fine.">
          {d.lowStock.map(({ variant, product }) => (
            <tr key={variant.id}>
              <td>
                <Link href={`/admin/products/${product.id}`} prefetch={false} className="link">
                  {product.name}
                </Link>
                <span className="ml-2 text-muted">{variantLabel(variant)}</span>
              </td>
              <td>{variant.stock}</td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}
