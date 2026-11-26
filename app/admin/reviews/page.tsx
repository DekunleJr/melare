import { asc, desc, eq, sql } from "drizzle-orm";
import { ActionButton, AdminHeader } from "@/components/admin/ui";
import { EmptyState, Stars, StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import { products, reviews, services } from "@/db/schema";
import { moderateReview } from "@/features/admin/content-actions";
import { requireAdmin } from "@/lib/session";
import { formatShortDate } from "@/lib/time";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  await requireAdmin();
  const rows = await db
    .select({ review: reviews, product: products.name, service: services.name })
    .from(reviews)
    .leftJoin(products, eq(products.id, reviews.productId))
    .leftJoin(services, eq(services.id, reviews.serviceId))
    .orderBy(asc(sql`${reviews.status} <> 'pending'`), desc(reviews.createdAt))
    .limit(100);

  return (
    <div className="max-w-3xl space-y-4">
      <AdminHeader title="Reviews" />
      {!rows.length && <EmptyState title="No reviews yet" />}
      {rows.map(({ review: r, product, service }) => (
        <article key={r.id} className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{product ?? service}</p>
            <StatusBadge status={r.status} />
          </div>
          <Stars rating={r.rating} />
          <p className="text-sm whitespace-pre-line">{r.comment}</p>
          <p className="text-xs text-muted">
            {r.authorName} · {formatShortDate(r.createdAt)}
          </p>
          <div className="flex flex-wrap gap-2">
            {r.status !== "approved" && (
              <ActionButton action={moderateReview.bind(null, r.id, "approved")}>Approve</ActionButton>
            )}
            {r.status !== "rejected" && (
              <ActionButton action={moderateReview.bind(null, r.id, "rejected")}>Reject</ActionButton>
            )}
            <ActionButton action={moderateReview.bind(null, r.id, "delete")} confirm="Delete this review?" danger>
              Delete
            </ActionButton>
          </div>
        </article>
      ))}
    </div>
  );
}
