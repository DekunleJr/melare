import Link from "next/link";
import { OrderList } from "@/components/site/history";
import { EmptyState } from "@/components/ui/misc";
import { getMyOrders } from "@/features/account/queries";

export default async function MyOrdersPage() {
  const orders = (await getMyOrders()).filter((o) => o.status !== "expired" || o.paidAt);
  return (
    <>
      <h1 className="mb-6 font-display text-4xl">Your orders</h1>
      {orders.length ? (
        <OrderList orders={orders} />
      ) : (
        <EmptyState title="No orders yet">
          <Link href="/shop" className="link">
            Visit the shop
          </Link>
        </EmptyState>
      )}
    </>
  );
}
