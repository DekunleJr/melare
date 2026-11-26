import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/site/cards";
import { EmptyState, Loading, PageHero } from "@/components/ui/misc";
import { getCategories, getShopProducts } from "@/features/content/queries";

export const metadata: Metadata = { title: "Shop" };

export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <>
      <PageHero eyebrow="Shop" title="Products we love">
        The same products our stylists use, delivered or ready to collect.
      </PageHero>
      <div className="bg-white">
        <div className="container-page py-12">
          <Suspense fallback={<Loading />}>
            <Catalogue searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

async function Catalogue({ searchParams }: Pick<PageProps<"/shop">, "searchParams">) {
  const params = await searchParams;
  const q = one(params.q).trim().slice(0, 100);
  const category = one(params.category);
  const sort = one(params.sort);
  const [products, categories] = await Promise.all([getShopProducts(), getCategories()]);

  const term = q.toLowerCase();
  const shown = products.filter(
    (p) =>
      (!category || p.category?.slug === category) &&
      (!term || `${p.name} ${p.description}`.toLowerCase().includes(term)),
  );
  if (sort === "price-asc") shown.sort((a, b) => a.pricePence - b.pricePence);
  if (sort === "price-desc") shown.sort((a, b) => b.pricePence - a.pricePence);
  if (sort === "name") shown.sort((a, b) => a.name.localeCompare(b.name));

  const link = (slug: string) => {
    const query = new URLSearchParams();
    if (slug) query.set("category", slug);
    if (q) query.set("q", q);
    if (sort) query.set("sort", sort);
    return `/shop${query.size ? `?${query}` : ""}`;
  };

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Categories" className="flex flex-wrap gap-2">
          {[{ slug: "", name: "All" }, ...categories].map((c) => (
            <Link
              key={c.slug}
              href={link(c.slug)}
              prefetch={false}
              aria-current={category === c.slug ? "page" : undefined}
              className={`chip ${category === c.slug ? "chip-active" : ""}`}
            >
              {c.name}
            </Link>
          ))}
        </nav>
        <form action="/shop" className="flex flex-wrap gap-2" key={`${q}-${sort}`}>
          {category && <input type="hidden" name="category" value={category} />}
          <input name="q" defaultValue={q} placeholder="Search products" aria-label="Search products" className="input w-48" />
          <select name="sort" defaultValue={sort} aria-label="Sort by" className="input w-44">
            <option value="">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name</option>
          </select>
          <button className="btn btn-outline">Search</button>
        </form>
      </div>
      {shown.length ? (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((product, i) => (
            <ProductCard key={product.id} product={product} eager={i < 4} />
          ))}
        </div>
      ) : (
        <EmptyState title="No products found">
          <Link href="/shop" className="link">
            Clear filters
          </Link>
        </EmptyState>
      )}
    </>
  );
}
