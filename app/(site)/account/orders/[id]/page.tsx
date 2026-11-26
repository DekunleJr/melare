import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/site/details";
import { accessOrder } from "@/features/access";
import { requireUser } from "@/lib/session";

export default async function MyOrderPage({ params }: PageProps<"/account/orders/[id]">) {
  const id = Number((await params).id);
  await requireUser(`/account/orders/${id || ""}`);
  const order = await accessOrder({ id });
  if (!order) notFound();
  return (
    <>
      <h1 className="mb-6 font-display text-4xl">Order {order.number}</h1>
      <OrderDetail order={order} access={{ id }} />
    </>
  );
}
