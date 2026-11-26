import { asc, desc, like } from "drizzle-orm";
import Link from "next/link";
import { RowActions } from "@/components/admin/row-actions";
import { AdminHeader, queryText, Table } from "@/components/admin/ui";
import { Photo, StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import { withProductDetails } from "@/db/relations";
import { products } from "@/db/schema";
import { deleteListedProduct, setProductStatus } from "@/features/admin/catalog-actions";
import { formatPence } from "@/lib/money";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin();
  const q = queryText((await searchParams).q);
  const search = q ? like(products.name, `%${q.replace(/[\\%_]/g, "\\$&")}%`) : undefined;
  const rows = await withProductDetails(
    await db
      .select()
      .from(products)
      .where(search)
      .orderBy(asc(products.status), desc(products.createdAt)),
  );

  return (
    <>
      <AdminHeader title="Products">
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search" aria-label="Search products" className="input w-44" />
          <button className="btn btn-outline btn-sm">Search</button>
        </form>
        <Link href="/admin/products/new" prefetch={false} className="btn btn-primary btn-sm">
          Add product
        </Link>
      </AdminHeader>
      <Table head={["", "Name", "Category", "Price", "Stock", "Status", "Action"]} empty="No products yet.">
        {rows.map((p) => {
          const prices = p.variants.map((v) => v.salePricePence || v.pricePence);
          const stock = p.variants.reduce((n, v) => n + v.stock, 0);
          const low = p.variants.some((v) => v.active && v.stock <= v.lowStockThreshold);
          return (
            <tr key={p.id}>
              <td className="w-16">
                <Photo src={p.images[0]} alt={p.name} className="size-12 rounded-lg" sizes="48px" />
              </td>
              <td>{p.name}</td>
              <td>{p.category?.name ?? "—"}</td>
              <td>
                {prices.length ? formatPence(Math.min(...prices)) : "—"}
                {new Set(prices).size > 1 && ` – ${formatPence(Math.max(...prices))}`}
              </td>
              <td className={low ? "font-semibold text-red-700" : ""}>
                {stock}
                {p.variants.length > 1 && (
                  <span className="ml-1 font-normal text-muted">({p.variants.length} options)</span>
                )}
              </td>
              <td>
                <StatusBadge status={p.status} />
              </td>
              <td>
                <RowActions
                  name={p.name}
                  status={p.status}
                  editHref={`/admin/products/${p.id}`}
                  statusAction={setProductStatus.bind(null, p.id)}
                  deleteAction={deleteListedProduct.bind(null, p.id)}
                  deleteNote="A product that has been sold is archived instead."
                />
              </td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
