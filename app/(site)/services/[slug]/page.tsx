import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReviewList } from "@/components/site/cards";
import { DetailList, Loading, Photo, Stars } from "@/components/ui/misc";
import { getPublicServices, getReviews } from "@/features/content/queries";
import { depositDue } from "@/features/pricing";
import { formatPence } from "@/lib/money";
import { formatDuration } from "@/lib/time";

const find = async (slug: string) => (await getPublicServices()).find((s) => s.slug === slug);

export async function generateMetadata({ params }: PageProps<"/services/[slug]">): Promise<Metadata> {
  const service = await find((await params).slug);
  return service ? { title: service.name, description: service.description.slice(0, 160) } : {};
}

export default function ServicePage({ params }: PageProps<"/services/[slug]">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ slug }) => (
        <Service slug={slug} />
      ))}
    </Suspense>
  );
}

async function Service({ slug }: { slug: string }) {
  const service = await find(slug);
  if (!service) notFound();
  const reviews = await getReviews({ serviceId: service.id });
  const due = depositDue(service, service.pricePence);

  return (
    <div className="container-page py-12">
      <Link href="/services" className="link text-sm">
        All services
      </Link>
      <div className="mt-5 grid gap-10 lg:grid-cols-2">
        <div>
          <Photo src={service.imagePath} alt={service.name} preload sizes="(min-width: 1024px) 50vw, 100vw" className="aspect-[4/3] rounded-3xl" />
          {service.photos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {service.photos.map((photo, i) => (
                <Photo key={photo.id} src={photo.path} alt={`${service.name}, photo ${i + 2}`} className="aspect-square rounded-xl" sizes="(min-width: 1024px) 16vw, 33vw" />
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="eyebrow">{service.category}</p>
          <h1 className="font-display text-4xl sm:text-5xl">{service.name}</h1>
          {service.rating && (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              <Stars rating={service.rating.average} /> {service.rating.total} review(s)
            </p>
          )}
          <p className="mt-4 leading-7 whitespace-pre-line">{service.description}</p>
          <div className="mt-6">
            <DetailList
              rows={[
                ["Price", formatPence(service.pricePence)],
                ["Duration", formatDuration(service.durationMinutes)],
                [
                  "Payment",
                  due === 0
                    ? "Pay at the salon"
                    : due < service.pricePence
                      ? `${formatPence(due)} deposit when booking`
                      : "Paid when booking",
                ],
                [
                  "Where",
                  service.locationMode === "both"
                    ? "At the salon or at your home"
                    : service.locationMode === "mobile"
                      ? "At your home"
                      : "At the salon",
                ],
                ["With", service.staff.map((p) => p.name).join(", ") || "Contact us"],
                ...service.addons.map((a): [string, string] => [
                  `Optional: ${a.name}`,
                  `+${formatPence(a.pricePence)}`,
                ]),
              ]}
            />
          </div>
          <Link href={`/book?service=${service.id}`} prefetch={false} className="btn btn-primary mt-7">
            Book this service
          </Link>
        </div>
      </div>
      {reviews.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-3xl">Reviews</h2>
          <ReviewList reviews={reviews} />
        </section>
      )}
    </div>
  );
}
