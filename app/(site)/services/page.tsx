import type { Metadata } from "next";
import { ServiceCard } from "@/components/site/cards";
import { EmptyState, PageHero } from "@/components/ui/misc";
import { getPublicServices } from "@/features/content/queries";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const services = await getPublicServices();
  const categories = [...new Set(services.map((s) => s.category))];
  return (
    <>
      <PageHero eyebrow="Treatments" title="Our services">
        Transparent prices, honest timings and online booking.
      </PageHero>
      <div className="container-page space-y-14 py-14">
        {!services.length && <EmptyState title="Services are coming soon" />}
        {categories.map((category, group) => (
          <section key={category}>
            <h2 className="mb-6 font-display text-3xl">{category}</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services
                .filter((s) => s.category === category)
                .map((service, i) => (
                  <ServiceCard key={service.id} service={service} eager={group === 0 && i < 3} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
