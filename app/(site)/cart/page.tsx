import type { Metadata } from "next";
import { CartView } from "@/components/site/cart-ui";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="container-page py-12">
      <h1 className="mb-8 font-display text-4xl">Your bag</h1>
      <CartView />
    </div>
  );
}
