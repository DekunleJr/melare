import { Clock } from "lucide-react";
import Link from "next/link";
import { Photo, Stars } from "@/components/ui/misc";
import type { PublicService, ShopProduct } from "@/features/content/queries";
import { formatPence } from "@/lib/money";
import { formatDuration, formatShortDate } from "@/lib/time";

export function ProductCard({ product, eager }: { product: ShopProduct; eager?: boolean }) {
  return (
    <Link href={`/shop/${product.slug}`} prefetch={false} className="group block">
      <Photo src={product.images[0]} alt={product.name} eager={eager} className="aspect-[4/5] rounded-2xl" />
      <div className="mt-3">
        {product.category && (
          <p className="text-xs uppercase tracking-wider text-muted">{product.category.name}</p>
        )}
        <h3 className="font-semibold group-hover:text-clay">{product.name}</h3>
        <p className="text-sm">
          {product.variesInPrice && "From "}
          {formatPence(product.pricePence)}
          {product.wasPence > 0 && (
            <>
              <s className="ml-2 text-muted">
                <span className="sr-only">Was </span>
                {formatPence(product.wasPence)}
              </s>
              <span className="ml-2 text-red-700">Sale</span>
            </>
          )}
          {product.stock <= 0 && <span className="ml-2 text-red-700">Sold out</span>}
        </p>
        {product.rating && <Stars rating={product.rating.average} size={13} />}
      </div>
    </Link>
  );
}

export function ServiceCard({ service, eager }: { service: PublicService; eager?: boolean }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
      <Link href={`/services/${service.slug}`} prefetch={false} tabIndex={-1} aria-hidden="true">
        <Photo src={service.imagePath} alt={service.name} eager={eager} className="aspect-[3/2]" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs uppercase tracking-wider text-muted">{service.category}</p>
        <h3 className="font-display text-2xl">
          <Link href={`/services/${service.slug}`} prefetch={false} className="hover:text-clay">
            {service.name}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{service.description}</p>
        <div className="mt-auto flex items-center justify-between pt-4">
          <p className="text-sm">
            <strong>{formatPence(service.pricePence)}</strong>
            <span className="ml-3 inline-flex items-center gap-1 text-muted">
              <Clock size={13} /> {formatDuration(service.durationMinutes)}
            </span>
          </p>
          <Link href={`/book?service=${service.id}`} prefetch={false} className="btn btn-outline btn-sm">
            Book
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ReviewList({
  reviews,
}: {
  reviews: { id: number; authorName: string; rating: number; comment: string; createdAt: Date }[];
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {reviews.map((r) => (
        <li key={r.id} className="card">
          <Stars rating={r.rating} />
          <p className="mt-2 text-sm leading-6 whitespace-pre-line">{r.comment}</p>
          <p className="mt-3 text-xs text-muted">
            {r.authorName} · {formatShortDate(r.createdAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}
