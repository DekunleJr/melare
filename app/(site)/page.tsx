import Link from "next/link";
import { ProductCard, ReviewList, ServiceCard } from "@/components/site/cards";
import { Photo, SectionTitle } from "@/components/ui/misc";
import {
  getGallery,
  getPublicServices,
  getReviews,
  getSettings,
  getShopProducts,
  getTeam,
} from "@/features/content/queries";
import { env } from "@/lib/env";

export default async function HomePage() {
  const [s, services, products, team, gallery, reviews] = await Promise.all([
    getSettings(),
    getPublicServices(),
    getShopProducts(),
    getTeam(),
    getGallery(),
    getReviews(),
  ]);
  const featured = <T extends { featured: boolean }>(list: T[], n: number) =>
    [...list].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, n);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: s.businessName,
    url: env.siteUrl,
    ...(s.phone ? { telephone: s.phone } : {}),
    ...(s.address ? { address: s.address } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // "<" is escaped so settings text can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <section className="border-b border-line">
        <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="eyebrow">{s.tagline}</p>
            <h1 className="font-display text-5xl leading-[1.05] sm:text-7xl">{s.heroTitle}</h1>
            <p className="mt-5 max-w-lg text-lg text-muted">{s.heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/book" className="btn btn-primary">
                Book an appointment
              </Link>
              <Link href="/shop" className="btn btn-outline">
                Shop products
              </Link>
            </div>
          </div>
          <Photo
            src={s.heroImage || null}
            alt={s.businessName}
            preload
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="aspect-[4/3] rounded-t-[10rem] rounded-b-3xl lg:aspect-[4/5]"
          />
        </div>
      </section>

      {services.length > 0 && (
        <section className="container-page py-16">
          <SectionTitle eyebrow="Treatments" title="Signature services" href="/services" linkLabel="All services" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured(services, 3).map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </section>
      )}

      {products.length > 0 && (
        <section className="border-y border-line py-16">
          <div className="container-page">
            <SectionTitle eyebrow="Take the salon home" title="From our shelves" href="/shop" linkLabel="Visit the shop" />
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
              {featured(products, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {team.length > 0 && (
        <section className="container-page py-16">
          <SectionTitle eyebrow="Our people" title="Meet the team" href="/about#team" linkLabel="Full team" />
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {team.slice(0, 4).map((person) => (
              <div key={person.id}>
                <Photo src={person.imagePath} alt={person.name} className="aspect-[3/4] rounded-2xl" />
                <h3 className="mt-3 font-semibold">{person.name}</h3>
                <p className="text-sm text-muted">{person.title}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {gallery.length > 0 && (
        <section className="container-page pb-16">
          <SectionTitle eyebrow="Recent work" title="Gallery" href="/gallery" linkLabel="See more" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {gallery.slice(0, 4).map((image) => (
              <Photo key={image.id} src={image.path} alt={image.caption || "Salon work"} className="aspect-square rounded-xl" />
            ))}
          </div>
        </section>
      )}

      {reviews.length > 0 && (
        <section className="border-y border-line py-16">
          <div className="container-page">
            <SectionTitle eyebrow="Kind words" title="From our customers" />
            <ReviewList reviews={reviews.slice(0, 6)} />
          </div>
        </section>
      )}

      <section className="container-page py-20 text-center">
        <h2 className="font-display text-4xl sm:text-5xl">Ready when you are</h2>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Choose a treatment, a stylist and a time. Booking takes about a minute, no account needed.
        </p>
        <Link href="/book" className="btn btn-primary mt-7">
          Book online
        </Link>
      </section>
    </>
  );
}
