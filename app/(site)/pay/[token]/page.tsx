import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ClearCart } from "@/components/site/cart-ui";
import { PaypalCheckout } from "@/components/site/paypal-checkout";
import { DetailList, Loading } from "@/components/ui/misc";
import { accessPayment } from "@/features/access";
import { getBooking } from "@/features/bookings/service";
import { getOrder } from "@/features/orders/service";
import { isPaypalConfigured, toValue } from "@/features/payments/paypal";
import { env } from "@/lib/env";
import { formatPence } from "@/lib/money";
import { readSettings } from "@/lib/settings";
import { formatDateTime, formatTime } from "@/lib/time";
import { manageToken } from "@/lib/tokens";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

export default function PayPage({ params, searchParams }: PageProps<"/pay/[token]">) {
  return (
    <div className="container-page max-w-xl py-12">
      <Suspense fallback={<Loading />}>
        <Pay params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Pay({ params, searchParams }: PageProps<"/pay/[token]">) {
  await connection();
  const token = decodeURIComponent((await params).token);
  const usedBag = (await searchParams).bag === "used";
  const payment = await accessPayment(token);
  if (!payment) notFound();
  const [booking, order, settings] = await Promise.all([
    payment.bookingId ? getBooking(payment.bookingId) : undefined,
    payment.orderId ? getOrder(payment.orderId) : undefined,
    readSettings(),
  ]);

  const now = new Date();
  const expired =
    payment.status === "pending" && payment.expiresAt !== null && payment.expiresAt <= now;
  const open = payment.status === "pending" && !expired;
  const done = payment.status === "completed";
  const checking = payment.status === "capturing" || payment.status === "processing";
  // A checkout that could not be honoured is refunded straight away.
  const lost =
    done &&
    payment.purpose === "checkout" &&
    ((booking && ["expired", "cancelled", "declined"].includes(booking.status)) ||
      (order && ["expired", "cancelled", "refunded"].includes(order.status)));

  const rows: [string, string][] = [["Reference", payment.reference]];
  if (booking) {
    rows.push(
      ["Appointment", `${booking.serviceName} with ${booking.staffName}`],
      ["When", formatDateTime(booking.startsAt)],
      ["Appointment total", formatPence(booking.totalPence)],
    );
    if (payment.purpose === "checkout" && payment.bookingPence < booking.totalPence) {
      rows.push([
        "Appointment: paying now",
        payment.bookingPence ? formatPence(payment.bookingPence) : "Pay at the appointment",
      ]);
    }
  }
  if (order) {
    for (const item of order.items) {
      rows.push([
        `${item.quantity} × ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ""}`,
        formatPence(item.unitPricePence * item.quantity),
      ]);
    }
    if (order.deliveryPence) rows.push(["Delivery", formatPence(order.deliveryPence)]);
    if (order.discountPence) {
      rows.push(["Product discount", `-${formatPence(order.discountPence)}`]);
    }
  }
  rows.push([done ? "Paid" : "To pay now", formatPence(payment.amountPence)]);

  const bookingLink = booking && `/manage/booking/${manageToken("booking", booking)}`;
  const orderLink = order && `/manage/order/${manageToken("order", order)}`;

  return (
    <div className="space-y-6">
      {usedBag && (done || checking) && <ClearCart />}
      <div className="text-center">
        {done && !lost && <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-700" />}
        <h1 className="font-display text-4xl">
          {done
            ? lost
              ? "Sorry, we could not complete this"
              : "Payment received"
            : open
              ? "Complete your payment"
              : checking
                ? "Payment is being checked"
                : "This payment has closed"}
        </h1>
        <p className="mt-3 text-muted">
          {done
            ? lost
              ? "Something was no longer available, so your money is being refunded."
              : "Thank you. A receipt has been sent to your email."
            : open
              ? payment.expiresAt
                ? `Please pay before ${payment.expiresAt.getTime() - now.getTime() < 3_600_000 ? formatTime(payment.expiresAt) : formatDateTime(payment.expiresAt)}. Your time and items are held until then.`
                : ""
              : checking
                ? "We will email you as soon as it is confirmed. You do not need to pay again."
                : "Nothing was charged. Please start again."}
        </p>
      </div>

      <div className="card">
        <DetailList rows={rows} />
      </div>

      {open &&
        (isPaypalConfigured() ? (
          <div className="card">
            <PaypalCheckout
              token={token}
              sdkUrl={env.paypal.sdkUrl}
              clientId={env.paypal.clientId}
              live={env.paypal.mode === "live"}
              amount={toValue(payment.amountPence)}
              businessName={settings.businessName}
            />
          </div>
        ) : (
          <p role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Online payment is not set up yet. Please contact the salon.
          </p>
        ))}

      <div className="flex flex-wrap justify-center gap-3">
        {done && (
          <Link href={`/receipt/${manageToken("payment", payment)}`} prefetch={false} className="btn btn-outline">
            View receipt
          </Link>
        )}
        {bookingLink && (
          <Link href={bookingLink} prefetch={false} className={`btn ${done ? "btn-primary" : "btn-outline"}`}>
            View booking
          </Link>
        )}
        {orderLink && !booking && (
          <Link href={orderLink} prefetch={false} className={`btn ${done ? "btn-primary" : "btn-outline"}`}>
            View order
          </Link>
        )}
        {!open && !done && !checking && (
          <Link href={booking ? "/book" : "/cart"} className="btn btn-primary">
            Start again
          </Link>
        )}
      </div>
    </div>
  );
}
