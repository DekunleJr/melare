import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm, VariantForm } from "@/components/admin/product-form";
import { ActionButton, AdminHeader, Created } from "@/components/admin/ui";
import { Photo } from "@/components/ui/misc";
import { db } from "@/db";
import { categories, productImages, productVariants, products } from "@/db/schema";
import {
  deleteProduct,
  deleteVariant,
  makeMainImage,
  removeProductImage,
} from "@/features/admin/catalog-actions";
import { variantLabel } from "@/features/pricing";
import { formatPence } from "@/lib/money";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const id = Number((await params).id) || 0;
  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) notFound();
  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, id))
    .orderBy(asc(productImages.sortOrder), asc(productImages.id));
  const list = await db.select().from(categories).orderBy(asc(categories.name));
  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, id))
    .orderBy(asc(productVariants.sortOrder), asc(productVariants.id));

  return (
    <div className="max-w-3xl space-y-6">
      <AdminHeader title={product.name}>
        {product.status === "active" && (
          <Link href={`/shop/${product.slug}`} prefetch={false} className="btn btn-outline btn-sm">
            View in shop
          </Link>
        )}
        <ActionButton action={deleteProduct.bind(null, id)} confirm="Delete this product?" danger>
          Delete
        </ActionButton>
      </AdminHeader>
      <Created show={(await searchParams).created} />
      <ProductForm product={product} categoryList={list} />
      <section className="card space-y-4">
        <div>
          <h2 className="font-display text-2xl">Options, prices and stock</h2>
          <p className="text-sm text-muted">
            Each combination of colour, length, texture and size has its own price and stock.
          </p>
        </div>
        {variants.map((v) => (
          <details key={v.id} className="rounded-xl border border-line p-4" open={variants.length === 1}>
            <summary className="cursor-pointer text-sm">
              <strong>{variantLabel(v) || "Standard"}</strong> · {formatPence(v.salePricePence || v.pricePence)}
              {v.salePricePence > 0 && " (sale)"} · {v.stock} in stock
              {!v.active && " · hidden"}
              {v.active && v.stock <= v.lowStockThreshold && (
                <span className="ml-2 font-semibold text-red-700">Low stock</span>
              )}
            </summary>
            <div className="mt-4 space-y-3">
              {v.imagePath && (
                <Photo src={v.imagePath} alt={variantLabel(v) || product.name} className="size-24 rounded-lg" sizes="96px" />
              )}
              <VariantForm productId={id} variant={v} />
              {variants.length > 1 && (
                <ActionButton action={deleteVariant.bind(null, v.id)} confirm="Remove this option?" danger>
                  Remove option
                </ActionButton>
              )}
            </div>
          </details>
        ))}
        <details className="rounded-xl border border-dashed border-line p-4">
          <summary className="cursor-pointer text-sm font-semibold">Add another option</summary>
          <div className="mt-4">
            <VariantForm productId={id} />
          </div>
        </details>
      </section>
      {images.length > 0 && (
        <section className="card">
          <h2 className="mb-4 font-display text-2xl">Images</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {images.map((image, i) => (
              <li key={image.id} className="space-y-2">
                <Photo src={image.path} alt={product.name} className="aspect-square rounded-xl" sizes="200px" />
                <div className="flex flex-wrap gap-2">
                  {i === 0 ? (
                    <span className="py-1.5 text-xs font-semibold text-muted">Main image</span>
                  ) : (
                    <ActionButton action={makeMainImage.bind(null, image.id)}>Make main</ActionButton>
                  )}
                  <ActionButton action={removeProductImage.bind(null, image.id)} confirm="Remove this image?" danger>
                    Remove
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
