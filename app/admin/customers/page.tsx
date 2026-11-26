import { sql, type SQL } from "drizzle-orm";
import { Eye } from "lucide-react";
import { AdminHeader, PAGE_SIZE, Pagination, queryPage, queryText, Table, IconLink } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Customers" };

type Row = {
  email: string;
  name: string;
  has_account: number;
  orders: number;
  bookings: number;
};

/** One line per email address, covering account holders and guests alike. */
async function findCustomers(q: string, page: number) {
  const term = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const filter: SQL = q ? sql`WHERE c.email LIKE ${term} OR c.name LIKE ${term}` : sql``;
  const [rows] = await db.execute(sql`
    SELECT c.email,
           MAX(c.name) AS name,
           MAX(c.has_account) AS has_account,
           SUM(c.is_order) AS orders,
           SUM(c.is_booking) AS bookings
    FROM (
      SELECT LOWER(email) AS email, name, 1 AS has_account, 0 AS is_order, 0 AS is_booking FROM user
      UNION ALL
      SELECT LOWER(customer_email), customer_name, 0, 1, 0 FROM orders WHERE paid_at IS NOT NULL
      UNION ALL
      SELECT LOWER(customer_email), customer_name, 0, 0, 1 FROM bookings
        WHERE status IN ('confirmed', 'completed', 'no_show', 'cancelled')
    ) AS c
    ${filter}
    GROUP BY c.email
    ORDER BY c.email
    LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}
  `);
  return rows as unknown as Row[];
}

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireAdmin();
  const params = await searchParams;
  const q = queryText(params.q);
  const page = queryPage(params.page);
  const rows = await findCustomers(q, page);

  return (
    <>
      <AdminHeader title="Customers">
        <a download href="/api/admin/export/customers" className="btn btn-outline btn-sm">
          Download CSV
        </a>
        <form className="flex gap-2" key={q}>
          <input name="q" defaultValue={q} placeholder="Name or email" aria-label="Search customers" className="input w-56" />
          <button className="btn btn-outline btn-sm">Search</button>
        </form>
      </AdminHeader>
      <Table head={["Name", "Email", "Type", "Paid orders", "Bookings", "Action"]} empty="No customers found.">
        {rows.slice(0, PAGE_SIZE).map((c) => (
          <tr key={c.email}>
            <td>{c.name}</td>
            <td>{c.email}</td>
            <td>
              <StatusBadge status={Number(c.has_account) ? "customer" : "logged"} />
            </td>
            <td>{Number(c.orders)}</td>
            <td>{Number(c.bookings)}</td>
            <td>
              <IconLink href={`/admin/customers/view?email=${encodeURIComponent(c.email)}`} label={`View ${c.name}`} icon={Eye} />
            </td>
          </tr>
        ))}
      </Table>
      <Pagination base="/admin/customers" page={page} hasMore={rows.length > PAGE_SIZE} params={{ q }} />
    </>
  );
}
