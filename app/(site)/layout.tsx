import { Suspense } from "react";
import { Footer, Header } from "@/components/site/chrome";
import { Analytics, CookieBanner } from "@/components/site/consent";
import { getSettings } from "@/features/content/queries";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const { gaMeasurementId } = await getSettings();
  return (
    <>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">
        Skip to content
      </a>
      <Header />
      <main id="content" className="flex-1">
        {children}
      </main>
      <Footer />
      <CookieBanner />
      {gaMeasurementId && (
        <Suspense>
          <Analytics measurementId={gaMeasurementId} />
        </Suspense>
      )}
    </>
  );
}
