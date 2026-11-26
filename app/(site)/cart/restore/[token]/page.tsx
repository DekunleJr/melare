import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RestoreCart } from "@/components/site/cart-ui";
import { EmptyState, Loading } from "@/components/ui/misc";
import { db } from "@/db";
import { savedCarts } from "@/db/schema";
import { readCartItems } from "@/features/carts";
import { parseTokenId, verifyToken } from "@/lib/tokens";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default function RestorePage({ params }: PageProps<"/cart/restore/[token]">) {
  return (
    <div className="container-page py-16">
      <Suspense fallback={<Loading />}>
        {params.then(({ token }) => (
          <Restore token={decodeURIComponent(token)} />
        ))}
      </Suspense>
    </div>
  );
}

async function Restore({ token }: { token: string }) {
  const id = parseTokenId(token);
  const [cart] = id ? await db.select().from(savedCarts).where(eq(savedCarts.id, id)) : [];
  if (!cart || !verifyToken("cart", token, cart)) {
    return (
      <EmptyState title="That bag is no longer saved">
        <Link href="/shop" className="link">
          Browse the shop
        </Link>
      </EmptyState>
    );
  }
  return <RestoreCart items={readCartItems(cart.items)} />;
}
