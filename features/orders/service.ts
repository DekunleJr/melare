import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { discountCodes, orderItems, orders, productVariants, products } from "@/db/schema";
import { UserError, withRetry } from "@/lib/errors";

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderStatus = Order["status"];

export const MAX_QUANTITY = 20;

export type CartLine = { variantId: number; quantity: number };

/** Combine repeated lines and check quantities. Sorted, so locks are taken in one order. */
export function tidyLines(items: CartLine[]): CartLine[] {
  const wanted = new Map<number, number>();
  for (const line of items) {
    wanted.set(line.variantId, (wanted.get(line.variantId) ?? 0) + line.quantity);
  }
  for (const quantity of wanted.values()) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new UserError(`You can order between 1 and ${MAX_QUANTITY} of each item.`);
    }
  }
  return [...wanted]
    .sort(([a], [b]) => a - b)
    .map(([variantId, quantity]) => ({ variantId, quantity }));
}

/** Deduct stock only if enough is left of an option that is still on sale. */
export async function takeStock(tx: Tx, variantId: number, quantity: number): Promise<boolean> {
  const [result] = await tx
    .update(productVariants)
    .set({ stock: sql`${productVariants.stock} - ${quantity}` })
    .where(
      and(
        eq(productVariants.id, variantId),
        eq(productVariants.active, true),
        gte(productVariants.stock, quantity),
        sql`exists (select 1 from ${products} where ${products.id} = ${productVariants.productId} and ${products.status} = 'active')`,
      ),
    );
  return result.affectedRows === 1;
}

export async function getOrder(id: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) return undefined;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return { ...order, items };
}

export async function lockOrder(tx: Tx, id: number): Promise<Order | undefined> {
  const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
  return order;
}

export async function returnStock(tx: Tx, order: Order) {
  if (!order.stockReserved) return;
  const items = (await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id)))
    .filter((i) => i.variantId !== null)
    .sort((a, b) => a.variantId! - b.variantId!);
  for (const item of items) {
    await tx
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} + ${item.quantity}` })
      .where(eq(productVariants.id, item.variantId!));
  }
  await tx.update(orders).set({ stockReserved: false }).where(eq(orders.id, order.id));
}

/** Give a discount code use back when a checkout is abandoned before payment. */
export async function returnDiscountUse(tx: Tx, discountCodeId: number | null) {
  if (!discountCodeId) return;
  await tx
    .update(discountCodes)
    .set({ usedCount: sql`greatest(${discountCodes.usedCount} - 1, 0)` })
    .where(eq(discountCodes.id, discountCodeId));
}

/** Close an unpaid order inside a transaction. Safe to call repeatedly. */
export async function releaseOrderTx(tx: Tx, id: number, status: "expired" | "cancelled") {
  const order = await lockOrder(tx, id);
  if (!order || order.status !== "pending") return false;
  await returnStock(tx, order);
  await returnDiscountUse(tx, order.discountCodeId);
  await tx
    .update(orders)
    .set({ status, discountCodeId: null, expiresAt: null })
    .where(eq(orders.id, id));
  return true;
}

export const releaseOrder = (id: number, status: "expired" | "cancelled") =>
  withRetry(() => db.transaction((tx) => releaseOrderTx(tx, id, status)));

/** What an admin may move an order to from each state. Cancelling is separate. */
export const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  pending: [],
  paid: ["processing", "ready_for_pickup", "shipped", "completed"],
  processing: ["ready_for_pickup", "shipped", "completed"],
  ready_for_pickup: ["completed"],
  shipped: ["completed"],
  completed: [],
  cancelled: [],
  expired: [],
  refunded: [],
};

export function allowedNextStatuses(order: Pick<Order, "status" | "fulfilment">) {
  const wrong = order.fulfilment === "delivery" ? "ready_for_pickup" : "shipped";
  return nextStatuses[order.status].filter((s) => s !== wrong);
}

export async function updateOrderStatus(id: number, status: OrderStatus, trackingInfo: string) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    if (!order) throw new UserError("Order not found.");
    if (status !== order.status && !allowedNextStatuses(order).includes(status)) {
      throw new UserError("That status change is not allowed.");
    }
    await tx.update(orders).set({ status, trackingInfo }).where(eq(orders.id, id));
    return status !== order.status;
  });
}

export const PAID_ORDER_STATUSES: OrderStatus[] = [
  "paid",
  "processing",
  "ready_for_pickup",
  "shipped",
  "completed",
];

/** Admin cancellation of a paid order, optionally returning items to stock. */
export async function cancelPaidOrder(id: number, restock: boolean) {
  return withRetry(() =>
    db.transaction(async (tx) => {
      const order = await lockOrder(tx, id);
      if (!order || ![...PAID_ORDER_STATUSES, "cancelled"].includes(order.status)) {
        throw new UserError("This order cannot be cancelled.");
      }
      if (order.status !== "cancelled") {
        if (restock) await returnStock(tx, order);
        await tx.update(orders).set({ status: "cancelled" }).where(eq(orders.id, id));
      }
      return order;
    }),
  );
}
