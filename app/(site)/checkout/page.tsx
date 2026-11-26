import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutView } from "@/components/site/cart-ui";
import { Loading } from "@/components/ui/misc";
import { getContactDefaults } from "@/features/account/queries";
import { getSettings } from "@/features/content/queries";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="container-page py-12">
      <h1 className="mb-8 font-display text-4xl">Checkout</h1>
      <Suspense fallback={<Loading />}>
        <Checkout />
      </Suspense>
    </div>
  );
}

async function Checkout() {
  const [defaults, s] = await Promise.all([getContactDefaults(), getSettings()]);
  return (
    <CheckoutView defaults={defaults} pickupEnabled={Boolean(s.pickupEnabled)} />
  );
}
