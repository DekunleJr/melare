import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, AdminHeader, queryText, Table } from "@/components/admin/ui";
import { DetailList, StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import { bookings, orders, profiles, user } from "@/db/schema";
import { updateAccount } from "@/features/admin/content-actions";
import { formatPence } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { formatDateTime, formatShortDate } from "@/lib/time";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ searchParams }: PageProps<"/admin/customers/view">) {
  const admin = await requireAdmin();
  const email = queryText((await searchParams).email).toLowerCase();
  if (!email) notFound();
  const [account] = await db.select().from(user).where(eq(user.email, email));
  const [profile] = account
    ? await db.select().from(profiles).where(eq(profiles.userId, account.id))
    : [];
  const theirOrders = await db.select().from(orders).where(eq(orders.customerEmail, email)).orderBy(desc(orders.createdAt));
  const theirBookings = await db.select().from(bookings).where(eq(bookings.customerEmail, email)).orderBy(desc(bookings.startsAt));
  if (!account && !theirOrders.length && !theirBookings.length) notFound();
  const name = account?.name ?? theirOrders[0]?.customerName ?? theirBookings[0]?.customerName;

  return (
    <div className="max-w-4xl space-y-6">
      <AdminHeader title={name} />
      <div className="card">
        <DetailList
          rows={[
            ["Email", email],
            ["Phone", profile?.phone || theirOrders[0]?.customerPhone || theirBookings[0]?.customerPhone || "—"],
            ["Account", account ? `Registered ${formatShortDate(account.createdAt)}` : "Guest only"],
            ...(account
              ? ([
                  ["Role", <StatusBadge key="r" status={account.role} />],
                  ["Sign-in", account.disabled ? "Disabled" : "Allowed"],
                ] as [string, React.ReactNode][])
              : []),
          ]}
        />
        {account && account.id !== admin.id && (
          <div className="mt-4 flex flex-wrap gap-3">
            {account.role === "admin" ? (
              <ActionButton action={updateAccount.bind(null, account.id, "make_customer")} confirm="Remove admin access?">
                Remove admin access
              </ActionButton>
            ) : (
              <ActionButton action={updateAccount.bind(null, account.id, "make_admin")} confirm="Give this person full control of the website?">
                Make admin
              </ActionButton>
            )}
            {account.disabled ? (
              <ActionButton action={updateAccount.bind(null, account.id, "enable")}>Allow sign-in</ActionButton>
            ) : (
              <ActionButton action={updateAccount.bind(null, account.id, "disable")} confirm="Block this account from signing in?" danger>
                Disable account
              </ActionButton>
            )}
          </div>
        )}
      </div>
      <h2 className="font-display text-2xl">Orders</h2>
      <Table head={["Order", "Date", "Total", "Status"]} empty="No orders.">
        {theirOrders.map((o) => (
          <tr key={o.id}>
            <td>
              <Link href={`/admin/orders/${o.id}`} prefetch={false} className="link">
                {o.number}
              </Link>
            </td>
            <td>{formatShortDate(o.createdAt)}</td>
            <td>{formatPence(o.totalPence)}</td>
            <td>
              <StatusBadge status={o.status} />
            </td>
          </tr>
        ))}
      </Table>
      <h2 className="font-display text-2xl">Bookings</h2>
      <Table head={["Reference", "When", "Service", "Status"]} empty="No bookings.">
        {theirBookings.map((b) => (
          <tr key={b.id}>
            <td>
              <Link href={`/admin/bookings/${b.id}`} prefetch={false} className="link">
                {b.reference}
              </Link>
            </td>
            <td>{formatDateTime(b.startsAt)}</td>
            <td>{b.serviceName}</td>
            <td>
              <StatusBadge status={b.status} />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
