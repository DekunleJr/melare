import { and, asc, desc, eq, gte, like, lt, or } from "drizzle-orm";
import Link from "next/link";
import { AdminHeader, PAGE_SIZE, Pagination, queryPage, queryText, Table } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import { bookings, bookingStatuses } from "@/db/schema/sales";
import { label } from "@/lib/labels";
import { formatPence } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { addDaysToKey, dateKey, dayRange, formatDate, formatDateTime, formatTime, isDateKey } from "@/lib/time";

export const metadata = { title: "Bookings" };

export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requireAdmin();
  const params = await searchParams;
  const q = queryText(params.q);
  const status = bookingStatuses.find((s) => s === queryText(params.status));
  const day = isDateKey(queryText(params.day)) ? queryText(params.day) : "";
  const page = queryPage(params.page);
  const term = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const range = day ? dayRange(day) : null;

  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        status ? eq(bookings.status, status) : undefined,
        range ? and(gte(bookings.startsAt, range.start), lt(bookings.startsAt, range.end)) : undefined,
        q
          ? or(
              like(bookings.reference, term),
              like(bookings.customerName, term),
              like(bookings.customerEmail, term),
              like(bookings.customerPhone, term),
            )
          : undefined,
      ),
    )
    .orderBy(day ? asc(bookings.startsAt) : desc(bookings.startsAt))
    .limit(day ? 500 : PAGE_SIZE + 1)
    .offset(day ? 0 : (page - 1) * PAGE_SIZE);
  const shown = day ? rows : rows.slice(0, PAGE_SIZE);
  const today = dateKey(new Date());

  return (
    <>
      <AdminHeader title="Bookings">
        <a download href="/api/admin/export/bookings" className="btn btn-outline btn-sm">
          Download CSV
        </a>
        <Link href={`/admin/bookings?day=${today}`} prefetch={false} className="btn btn-outline btn-sm">
          Today
        </Link>
        <Link href="/admin/bookings/new" prefetch={false} className="btn btn-primary btn-sm">
          Add booking
        </Link>
      </AdminHeader>
      <form className="mb-4 flex flex-wrap gap-2" key={`${q}-${status}-${day}`}>
        <input name="q" defaultValue={q} placeholder="Name, email, phone, reference" aria-label="Search" className="input w-64" />
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className="input w-44">
          <option value="">All statuses</option>
          {bookingStatuses.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <input type="date" name="day" defaultValue={day} aria-label="Day" className="input w-44" />
        <button className="btn btn-outline btn-sm">Filter</button>
        {(q || status || day) && (
          <Link href="/admin/bookings" prefetch={false} className="link self-center text-sm">
            Clear
          </Link>
        )}
      </form>
      {day && (
        <div className="mb-3 flex items-center gap-4 text-sm">
          <Link href={`/admin/bookings?day=${addDaysToKey(day, -1)}`} prefetch={false} className="link">
            Previous day
          </Link>
          <strong>{formatDate(dayRange(day).start)}</strong>
          <Link href={`/admin/bookings?day=${addDaysToKey(day, 1)}`} prefetch={false} className="link">
            Next day
          </Link>
        </div>
      )}
      <Table head={["When", "Reference", "Customer", "Service", "With", "Paid", "Status"]} empty="No bookings found.">
        {shown.map((b) => (
          <tr key={b.id}>
            <td className="whitespace-nowrap">
              {day ? `${formatTime(b.startsAt)} – ${formatTime(b.endsAt)}` : formatDateTime(b.startsAt)}
            </td>
            <td>
              <Link href={`/admin/bookings/${b.id}`} prefetch={false} className="link">
                {b.reference}
              </Link>
            </td>
            <td>
              {b.customerName}
              <span className="block text-xs text-muted">{b.customerPhone}</span>
            </td>
            <td>{b.serviceName}</td>
            <td>{b.staffName}</td>
            <td>{b.paidPence ? formatPence(b.paidPence - b.refundedPence) : "—"}</td>
            <td>
              <StatusBadge status={b.status} />
            </td>
          </tr>
        ))}
      </Table>
      {!day && (
        <Pagination base="/admin/bookings" page={page} hasMore={rows.length > PAGE_SIZE} params={{ q, status: status ?? "" }} />
      )}
    </>
  );
}
