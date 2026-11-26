import { asc } from "drizzle-orm";
import { ActionButton, AdminHeader } from "@/components/admin/ui";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { deleteCategory, saveCategory } from "@/features/admin/catalog-actions";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireAdmin();
  const list = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return (
    <div className="max-w-2xl space-y-4">
      <AdminHeader title="Product categories" />
      <ActionForm action={saveCategory.bind(null, null)} resetOnSuccess className="card flex flex-wrap items-end gap-3">
        <Field name="name" label="New category" required wrapperClass="flex-1" />
        <Field name="sortOrder" label="Order" type="number" min={0} defaultValue={0} wrapperClass="w-24" />
        <SubmitButton>Add</SubmitButton>
      </ActionForm>
      {list.map((c) => (
        <div key={c.id} className="card flex flex-wrap items-end gap-3">
          <ActionForm action={saveCategory.bind(null, c.id)} className="flex flex-1 flex-wrap items-end gap-3">
            <Field name="name" label="Name" required defaultValue={c.name} wrapperClass="flex-1" />
            <Field name="sortOrder" label="Order" type="number" min={0} defaultValue={c.sortOrder} wrapperClass="w-24" />
            <SubmitButton className="btn btn-outline">Save</SubmitButton>
          </ActionForm>
          <ActionButton action={deleteCategory.bind(null, c.id)} confirm="Delete this category? Products stay, without a category." danger>
            Delete
          </ActionButton>
        </div>
      ))}
    </div>
  );
}
