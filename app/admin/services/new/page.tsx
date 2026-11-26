import { asc } from "drizzle-orm";
import { ServiceForm } from "@/components/admin/service-form";
import { AdminHeader } from "@/components/admin/ui";
import { db } from "@/db";
import { categories, staff } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Add service" };

export default async function NewServicePage() {
  await requireAdmin();
  const people = await db.select().from(staff).orderBy(asc(staff.name));
  const productCategories = await db.select().from(categories).orderBy(asc(categories.name));
  return (
    <div className="max-w-3xl">
      <AdminHeader title="Add service" />
      <ServiceForm people={people} assigned={[]} productCategories={productCategories} />
    </div>
  );
}
