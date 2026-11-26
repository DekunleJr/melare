import { and, desc, eq, like, or } from "drizzle-orm";
import Link from "next/link";
import { AdminHeader, PAGE_SIZE, Pagination, queryPage, queryText, Table, IconLink } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import { withOrderItems } from "@/db/relations";
import { orders, orderStatuses } from "@/db/schema/sales";
import { label } from "@/lib/labels";
import { formatPence } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const params = await searchParams;
  const q = queryText(params.q);
  const status = orderStatuses.find((s) => s === queryText(params.status));
  const page = queryPage(params.page);
  const term = `%${q.replace(/[\\%_]/g, "\\$&")}%`;

  const search = q
    ? or(like(orders.number, term), like(orders.customerName, term), like(orders.customerEmail, term))
    : undefined;
  const rows = await withOrderItems(
    await db
      .select()
      .from(orders)
      .where(and(status ? eq(orders.status, status) : undefined, search))
      .orderBy(desc(orders.createdAt))
      .limit(PAGE_SIZE + 1)
      .offset((page - 1) * PAGE_SIZE),
  );

  return (
    <>
      <AdminHeader title="Orders">
        <a download href="/api/admin/export/orders" className="btn btn-outline btn-sm">
          Download CSV
        </a>
      </AdminHeader>
      <form className="mb-4 flex flex-wrap gap-2" key={`${q}-${status}`}>
        <input name="q" defaultValue={q} placeholder="Order number, name, email" aria-label="Search" className="input w-64" />
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className="input w-48">
          <option value="">All statuses</option>
          {orderStatuses.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <button className="btn btn-outline btn-sm">Filter</button>
        {(q || status) && (
          <Link href="/admin/orders" prefetch={false} className="link self-center text-sm">
            Clear
          </Link>
        )}
      </form>
      <Table head={["Order", "Placed", "Customer", "Items", "Method", "Total", "Status", "Action"]} empty="No orders found.">
        {rows.slice(0, PAGE_SIZE).map((o) => (
          <tr key={o.id}>
            <td>{o.number}</td>
            <td className="whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
            <td>
              {o.customerName}
              <span className="block text-xs text-muted">{o.userId ? "Account" : "Guest"}</span>
            </td>
            <td>{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
            <td>{label(o.fulfilment)}</td>
            <td>{formatPence(o.totalPence)}</td>
            <td>
              <StatusBadge status={o.status} />
            </td>
            <td>
              <IconLink href={`/admin/orders/${o.id}`} label={`Edit order ${o.number}`} />
            </td>
          </tr>
        ))}
      </Table>
      <Pagination base="/admin/orders" page={page} hasMore={rows.length > PAGE_SIZE} params={{ q, status: status ?? "" }} />
    </>
  );
}
