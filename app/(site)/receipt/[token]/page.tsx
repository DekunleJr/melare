import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintButton } from "@/components/site/print-button";
import { DetailList, Loading } from "@/components/ui/misc";
import { accessPayment } from "@/features/access";
import { getBooking } from "@/features/bookings/service";
import { getOrder } from "@/features/orders/service";
import { paymentsFor } from "@/features/payments/ledger";
import { label } from "@/lib/labels";
import { formatPence } from "@/lib/money";
import { readSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Receipt", robots: { index: false } };

export default function ReceiptPage({ params }: PageProps<"/receipt/[token]">) {
  return (
    <div className="container-page max-w-xl py-12">
      <Suspense fallback={<Loading />}>
        {params.then(({ token }) => (
          <Receipt token={decodeURIComponent(token)} />
        ))}
      </Suspense>
    </div>
  );
}

async function Receipt({ token }: { token: string }) {
  const payment = await accessPayment(token);
  if (!payment || payment.status !== "completed") notFound();
  const [record] = await paymentsFor({ paymentId: payment.id });
  const [booking, order, s] = await Promise.all([
    payment.bookingId ? getBooking(payment.bookingId) : undefined,
    payment.orderId ? getOrder(payment.orderId) : undefined,
    readSettings(),
  ]);
  const customer = booking ?? order;
  const rows: [string, string][] = [
    ["Receipt number", payment.reference],
    ["Date", formatDateTime(payment.completedAt ?? payment.createdAt)],
    ["Customer", customer ? `${customer.customerName}\n${customer.customerEmail}` : "—"],
    ["Paid by", label(payment.method)],
  ];
  if (payment.captureId) rows.push(["Transaction", payment.captureId]);
  if (booking && payment.bookingPence) {
    rows.push([
      `${booking.serviceName}, ${formatDateTime(booking.startsAt)} (${booking.reference})`,
      formatPence(payment.bookingPence),
    ]);
  }
  if (order && payment.orderPence) {
    for (const item of order.items) {
      rows.push([
        `${item.quantity} × ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ""}`,
        formatPence(item.unitPricePence * item.quantity),
      ]);
    }
    if (order.deliveryPence) rows.push(["Delivery", formatPence(order.deliveryPence)]);
    if (order.discountPence) rows.push(["Discount", `-${formatPence(order.discountPence)}`]);
  }
  rows.push(["Total paid", formatPence(payment.amountPence)]);
  for (const refund of record.refunds) {
    rows.push([`Refunded ${formatDateTime(refund.createdAt)}`, `-${formatPence(refund.amountPence)}`]);
  }

  return (
    <div className="card space-y-5">
      <div>
        <p className="font-display text-3xl">{s.businessName}</p>
        <p className="text-sm whitespace-pre-line text-muted">
          {[s.address, s.publicEmail, s.phone].filter(Boolean).join("\n")}
        </p>
      </div>
      <h1 className="text-xl font-semibold">Payment receipt</h1>
      <DetailList rows={rows} />
      <p className="text-xs text-muted">Prices include VAT where it applies.</p>
      <PrintButton />
    </div>
  );
}
