import { asc, ne } from "drizzle-orm";
import { StaffForm } from "@/components/admin/staff-form";
import { AdminHeader } from "@/components/admin/ui";
import { db } from "@/db";
import { services } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Add team member" };

export default async function NewStaffPage() {
  await requireAdmin();
  const list = await db.select().from(services).where(ne(services.status, "archived")).orderBy(asc(services.name));
  return (
    <div className="max-w-3xl">
      <AdminHeader title="Add team member" />
      <StaffForm serviceList={list} assigned={[]} />
    </div>
  );
}
