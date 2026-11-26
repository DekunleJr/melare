import { asc } from "drizzle-orm";
import Link from "next/link";
import { RowActions } from "@/components/admin/row-actions";
import { AdminHeader, Table } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import { withServiceStaff } from "@/db/relations";
import { services } from "@/db/schema";
import { deleteListedService, setServiceStatus } from "@/features/admin/catalog-actions";
import { label } from "@/lib/labels";
import { formatPence } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { formatDuration } from "@/lib/time";

export const metadata = { title: "Services" };

export default async function ServicesAdminPage() {
  await requireAdmin();
  const rows = await withServiceStaff(
    await db
      .select()
      .from(services)
      .orderBy(asc(services.status), asc(services.category), asc(services.name)),
  );
  return (
    <>
      <AdminHeader title="Services">
        <Link href="/admin/services/new" prefetch={false} className="btn btn-primary btn-sm">
          Add service
        </Link>
      </AdminHeader>
      <Table head={["Name", "Group", "Duration", "Price", "Payment", "Staff", "Status", "Action"]} empty="No services yet.">
        {rows.map((s) => (
          <tr key={s.id}>
            <td>{s.name}</td>
            <td>{s.category}</td>
            <td>{formatDuration(s.durationMinutes)}</td>
            <td>{formatPence(s.pricePence)}</td>
            <td>
              {label(s.paymentMode)}
              {s.paymentMode === "deposit" && ` (${formatPence(s.depositPence)})`}
            </td>
            <td className={s.staff.length ? "" : "text-red-700"}>{s.staff.length || "None"}</td>
            <td>
              <StatusBadge status={s.status} />
            </td>
            <td>
              <RowActions
                name={s.name}
                status={s.status}
                editHref={`/admin/services/${s.id}`}
                statusAction={setServiceStatus.bind(null, s.id)}
                deleteAction={deleteListedService.bind(null, s.id)}
                deleteNote="A service that has bookings is archived instead."
              />
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
