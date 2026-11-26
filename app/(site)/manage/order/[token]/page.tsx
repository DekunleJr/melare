import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderDetail } from "@/components/site/details";
import { NewNotice } from "@/components/site/new-notice";
import { Loading } from "@/components/ui/misc";
import { accessOrder } from "@/features/access";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

export default function ManageOrderPage({
  params,
  searchParams,
}: PageProps<"/manage/order/[token]">) {
  return (
    <div className="container-page max-w-2xl py-12">
      <h1 className="mb-6 font-display text-4xl">Your order</h1>
      <Suspense>
        {searchParams.then((query) => (
          <NewNotice kind="order" isNew={query.new === "1"} usedBag={query.bag === "used"} />
        ))}
      </Suspense>
      <Suspense fallback={<Loading />}>
        {params.then(({ token }) => (
          <Order token={decodeURIComponent(token)} />
        ))}
      </Suspense>
    </div>
  );
}

async function Order({ token }: { token: string }) {
  const order = await accessOrder({ token });
  if (!order) notFound();
  return <OrderDetail order={order} access={{ token }} />;
}
