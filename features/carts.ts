import "server-only";
import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { orders, productVariants, products, savedCarts } from "@/db/schema";
import { notifyAbandonedCart } from "@/features/notifications";
import { PAID_ORDER_STATUSES, type CartLine } from "@/features/orders/service";
import { variantLabel } from "@/features/pricing";
import { readSettings } from "@/lib/settings";
import { newNonce } from "@/lib/tokens";

/** Baskets are only kept for people who ticked "remind me", and never for long. */
export const CART_KEEP_DAYS = 30;

export async function saveCart(input: { email: string; name: string; items: CartLine[] }) {
  const items = JSON.stringify(input.items);
  // A record of an earlier reminder is kept, so nobody gets a second one for the
  // same saved basket. It is cleared when the address buys or the basket expires.
  await db
    .insert(savedCarts)
    .values({ email: input.email, name: input.name, items, tokenNonce: newNonce() })
    .onDuplicateKeyUpdate({ set: { name: input.name, items, updatedAt: new Date() } });
}

export const forgetCart = (email: string) =>
  db.delete(savedCarts).where(eq(savedCarts.email, email));

export function readCartItems(json: string): CartLine[] {
  try {
    const value: unknown = JSON.parse(json);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (l): l is CartLine => Number.isInteger(l?.variantId) && Number.isInteger(l?.quantity),
    );
  } catch {
    return [];
  }
}

export async function sendCartReminders(now = new Date()) {
  await db
    .delete(savedCarts)
    .where(lt(savedCarts.updatedAt, new Date(now.getTime() - CART_KEEP_DAYS * 86_400_000)));

  const { abandonedCartHours } = await readSettings();
  if (abandonedCartHours <= 0) return 0;
  const due = await db
    .select()
    .from(savedCarts)
    .where(
      and(
        isNull(savedCarts.remindedAt),
        lt(savedCarts.updatedAt, new Date(now.getTime() - abandonedCartHours * 3_600_000)),
      ),
    )
    .limit(50);

  let sent = 0;
  for (const cart of due) {
    const [bought] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.customerEmail, cart.email),
          inArray(orders.status, PAID_ORDER_STATUSES),
          gte(orders.createdAt, new Date(cart.updatedAt.getTime() - 3_600_000)),
        ),
      )
      .limit(1);
    const items = readCartItems(cart.items);
    const rows = items.length
      ? await db
          .select({ variant: productVariants, product: products })
          .from(productVariants)
          .innerJoin(products, eq(products.id, productVariants.productId))
          .where(
            and(
              inArray(productVariants.id, items.map((i) => i.variantId)),
              eq(products.status, "active"),
            ),
          )
      : [];
    const lines: [string, string][] = items.flatMap((item) => {
      const row = rows.find((r) => r.variant.id === item.variantId);
      if (!row || row.variant.stock < 1) return [];
      const label = variantLabel(row.variant);
      return [[`${row.product.name}${label ? ` (${label})` : ""}`, `× ${item.quantity}`]];
    });
    if (bought || !lines.length) {
      await db.delete(savedCarts).where(eq(savedCarts.id, cart.id));
      continue;
    }
    // Marked first so overlapping runs cannot send twice.
    await db
      .update(savedCarts)
      .set({ remindedAt: now, updatedAt: cart.updatedAt })
      .where(eq(savedCarts.id, cart.id));
    await notifyAbandonedCart(cart, lines);
    sent++;
  }
  return sent;
}
