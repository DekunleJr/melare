import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductCard, ReviewList } from "@/components/site/cards";
import { ProductView } from "@/components/site/product-view";
import { Loading, Stars } from "@/components/ui/misc";
import { getReviews, getShopProducts } from "@/features/content/queries";

const find = async (slug: string) => (await getShopProducts()).find((p) => p.slug === slug);

export async function generateMetadata({ params }: PageProps<"/shop/[slug]">): Promise<Metadata> {
  const product = await find((await params).slug);
  return product
    ? {
        title: product.name,
        description: product.description.slice(0, 160),
        openGraph: product.images[0] ? { images: [product.images[0]] } : undefined,
      }
    : {};
}

export default function ProductPage({ params }: PageProps<"/shop/[slug]">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ slug }) => (
        <Product slug={slug} />
      ))}
    </Suspense>
  );
}

async function Product({ slug }: { slug: string }) {
  const product = await find(slug);
  if (!product) notFound();
  const [reviews, all] = await Promise.all([
    getReviews({ productId: product.id }),
    getShopProducts(),
  ]);
  const related = all
    .filter((p) => p.id !== product.id && p.categoryId === product.categoryId)
    .slice(0, 4);

  return (
    <div className="container-page py-12">
      <Link href="/shop" className="link text-sm">
        Back to shop
      </Link>
      <ProductView
        key={product.id}
        name={product.name}
        images={product.images}
        variants={product.variants}
        heading={
          <>
            {product.category && <p className="eyebrow">{product.category.name}</p>}
            <h1 className="font-display text-4xl sm:text-5xl">{product.name}</h1>
            {product.rating && (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                <Stars rating={product.rating.average} /> {product.rating.total} review(s)
              </p>
            )}
          </>
        }
      >
        <p className="mt-4 mb-6 leading-7 whitespace-pre-line">{product.description}</p>
      </ProductView>
      {reviews.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-3xl">Reviews</h2>
          <ReviewList reviews={reviews} />
        </section>
      )}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-3xl">You may also like</h2>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
