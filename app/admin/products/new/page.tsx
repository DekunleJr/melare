import { asc } from "drizzle-orm";
import { ProductForm } from "@/components/admin/product-form";
import { AdminHeader } from "@/components/admin/ui";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  await requireAdmin();
  const list = await db.select().from(categories).orderBy(asc(categories.name));
  return (
    <div className="max-w-3xl">
      <AdminHeader title="Add product" />
      <ProductForm categoryList={list} />
    </div>
  );
}
