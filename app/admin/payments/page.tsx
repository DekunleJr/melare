import { and, desc, eq, inArray, like, or } from "drizzle-orm";
import Link from "next/link";
import { AdminHeader, PAGE_SIZE, Pagination, queryPage, queryText, Table } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import { groupBy } from "@/db/relations";
import { payments, refunds } from "@/db/schema";
import { paymentMethods, paymentStatuses } from "@/db/schema/sales";
import { label } from "@/lib/labels";
import { formatPence } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requireAdmin();
  const params = await searchParams;
  const q = queryText(params.q);
  const status = paymentStatuses.find((s) => s === queryText(params.status));
  const method = paymentMethods.find((m) => m === queryText(params.method));
  const page = queryPage(params.page);
  const term = `%${q.replace(/[\\%_]/g, "\\$&")}%`;

  const rows = await db
    .select()
    .from(payments)
    .where(
      and(
        status
          ? eq(payments.status, status)
          : inArray(payments.status, ["pending", "capturing", "processing", "completed", "failed"]),
        method ? eq(payments.method, method) : undefined,
        q ? or(like(payments.reference, term), like(payments.captureId, term)) : undefined,
      ),
    )
    .orderBy(desc(payments.createdAt), desc(payments.id))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  const shown = rows.slice(0, PAGE_SIZE);
  const back = groupBy(
    await db
      .select()
      .from(refunds)
      .where(inArray(refunds.paymentId, shown.length ? shown.map((p) => p.id) : [0])),
    (r) => r.paymentId,
  );

  return (
    <>
      <AdminHeader title="Payments">
        <a download href="/api/admin/export/payments" className="btn btn-outline btn-sm">
          Download CSV
        </a>
      </AdminHeader>
      <p className="mb-3 text-sm text-muted">
        To refund, open the order or booking. One payment can cover both.
      </p>
      <form className="mb-4 flex flex-wrap gap-2" key={`${q}-${status}-${method}`}>
        <input name="q" defaultValue={q} placeholder="Reference or transaction" aria-label="Search" className="input w-60" />
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className="input w-44">
          <option value="">All current</option>
          {paymentStatuses.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <select name="method" defaultValue={method ?? ""} aria-label="Method" className="input w-44">
          <option value="">All methods</option>
          {paymentMethods.map((m) => (
            <option key={m} value={m}>
              {label(m)}
            </option>
          ))}
        </select>
        <button className="btn btn-outline btn-sm">Filter</button>
      </form>
      <Table head={["Payment", "Date", "Method", "For", "Amount", "Refunded", "Status"]} empty="No payments found.">
        {shown.map((p) => (
          <tr key={p.id}>
            <td>
              {p.reference}
              {p.captureId && <span className="block text-xs text-muted">{p.captureId}</span>}
            </td>
            <td className="whitespace-nowrap">{formatDateTime(p.completedAt ?? p.createdAt)}</td>
            <td>{label(p.method)}</td>
            <td className="space-x-2">
              {p.bookingId && (
                <Link href={`/admin/bookings/${p.bookingId}`} prefetch={false} className="link">
                  Booking
                </Link>
              )}
              {p.orderId && (
                <Link href={`/admin/orders/${p.orderId}`} prefetch={false} className="link">
                  Order
                </Link>
              )}
            </td>
            <td>{formatPence(p.amountPence)}</td>
            <td>{formatPence((back.get(p.id) ?? []).reduce((n, r) => n + r.amountPence, 0))}</td>
            <td>
              <StatusBadge status={p.status} />
            </td>
          </tr>
        ))}
      </Table>
      <Pagination base="/admin/payments" page={page} hasMore={rows.length > PAGE_SIZE} params={{ q, status: status ?? "", method: method ?? "" }} />
    </>
  );
}
