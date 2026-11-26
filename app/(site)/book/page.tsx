import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BookingWizard } from "@/components/site/booking-wizard";
import { EmptyState, Loading, PageHero } from "@/components/ui/misc";
import { getContactDefaults } from "@/features/account/queries";
import { bookingWindow } from "@/features/bookings/availability";
import {
  getMobileDistricts,
  getPublicServices,
  getSettings,
  getShopProducts,
} from "@/features/content/queries";

export const metadata: Metadata = { title: "Book online" };

export default function BookPage({ searchParams }: PageProps<"/book">) {
  return (
    <>
      <PageHero eyebrow="Online booking" title="Book your appointment">
        In the salon or at your home, with the hair and products to match.
      </PageHero>
      <div className="container-page max-w-3xl py-12">
        <Suspense fallback={<Loading />}>
          <Booking searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function Booking({ searchParams }: Pick<PageProps<"/book">, "searchParams">) {
  const { service, bag } = await searchParams;
  // Today's date matters here, so render per request.
  await connection();
  const [services, products, areas, settings, defaults] = await Promise.all([
    getPublicServices(),
    getShopProducts(),
    getMobileDistricts(),
    getSettings(),
    getContactDefaults(),
  ]);
  if (!services.length) return <EmptyState title="Online booking opens soon" />;
  const initial = services.find((s) => String(s.id) === service);

  return (
    <BookingWizard
      key={`${initial?.id ?? 0}-${bag ?? ""}`}
      services={services.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        durationMinutes: s.durationMinutes,
        pricePence: s.pricePence,
        locationMode: s.locationMode,
        requiresApproval: s.requiresApproval,
        suggestedCategoryId: s.suggestedCategoryId,
        addons: s.addons.map((a) => ({
          id: a.id,
          name: a.name,
          pricePence: a.pricePence,
          extraMinutes: a.extraMinutes,
        })),
        staff: s.staff.map((p) => ({
          id: p.id,
          name: p.name,
          title: p.title,
          offersMobile: p.offersMobile,
        })),
      }))}
      products={products
        .filter((p) => p.variants.length)
        .map((p) => ({
          id: p.id,
          name: p.name,
          categoryId: p.categoryId,
          categoryName: p.category?.name ?? "",
          variants: p.variants.map((v) => ({
            id: v.id,
            label: v.label,
            pricePence: v.nowPence,
            stock: v.stock,
          })),
        }))}
      areas={settings.mobileEnabled ? areas.map((a) => ({ district: a.district })) : []}
      window={bookingWindow(new Date(), settings)}
      defaults={defaults}
      initialServiceId={initial?.id ?? null}
      includeBagFirst={bag === "1"}
      policy={settings.cancellationPolicy}
      pickupEnabled={Boolean(settings.pickupEnabled)}
    />
  );
}
