import { asc } from "drizzle-orm";
import Link from "next/link";
import { AdminHeader, Table } from "@/components/admin/ui";
import { Photo, StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import { withStaffDetails } from "@/db/relations";
import { staff } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { WEEKDAYS } from "@/lib/time";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  await requireAdmin();
  const rows = await withStaffDetails(
    await db.select().from(staff).orderBy(asc(staff.sortOrder), asc(staff.name)),
  );
  return (
    <>
      <AdminHeader title="Staff">
        <Link href="/admin/staff/new" prefetch={false} className="btn btn-primary btn-sm">
          Add team member
        </Link>
      </AdminHeader>
      <Table head={["", "Name", "Role", "Services", "Working days", "Status"]} empty="No staff yet. Add someone so customers can book.">
        {rows.map((p) => {
          const days = [...new Set(p.hours.map((h) => h.weekday))].sort((a, b) => a - b);
          return (
            <tr key={p.id}>
              <td className="w-16">
                <Photo src={p.imagePath} alt={p.name} className="size-12 rounded-full" sizes="48px" />
              </td>
              <td>
                <Link href={`/admin/staff/${p.id}`} prefetch={false} className="link">
                  {p.name}
                </Link>
              </td>
              <td>{p.title}</td>
              <td>{p.services.length}</td>
              <td className={days.length ? "" : "text-red-700"}>
                {days.map((d) => WEEKDAYS[d].slice(0, 3)).join(", ") || "No hours set"}
              </td>
              <td>
                <StatusBadge status={p.active ? "active" : "archived"} />
              </td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
