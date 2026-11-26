import { asc, eq } from "drizzle-orm";
import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import { ActionForm, Select, SubmitButton, TextArea } from "@/components/ui/form";
import { DetailList, Photo, Stars, StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import { bookingAddons, bookingImages, orders, reviews } from "@/db/schema";
import type { Access } from "@/features/access";
import { bookingWindow, canCustomerModify } from "@/features/bookings/availability";
import { customerCancelBooking, payBalance } from "@/features/bookings/actions";
import type { Booking } from "@/features/bookings/service";
import { PAID_ORDER_STATUSES, type Order, type OrderItem } from "@/features/orders/service";
import { balanceDue, paymentsFor, type PaymentWithRefunds } from "@/features/payments/ledger";
import { submitReview } from "@/features/site/actions";
import { label } from "@/lib/labels";
import { formatPence } from "@/lib/money";
import { readSettings } from "@/lib/settings";
import { formatDateTime, formatShortDate } from "@/lib/time";
import { manageToken } from "@/lib/tokens";
import { ReschedulePanel } from "./reschedule-panel";

function ReviewForm({ target }: { target: Parameters<typeof submitReview>[0] }) {
  return (
    <ActionForm action={submitReview.bind(null, target)} className="space-y-3">
      <Select name="rating" label="Rating" defaultValue="5">
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n} star{n > 1 ? "s" : ""}
          </option>
        ))}
      </Select>
      <TextArea name="comment" label="Your review" rows={3} required maxLength={1500} />
      <SubmitButton className="btn btn-outline btn-sm">Send review</SubmitButton>
    </ActionForm>
  );
}

function ExistingReview({ rating, status }: { rating: number; status: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted">
      Your review: <Stars rating={rating} />
      {status === "pending" && "(awaiting approval)"}
    </p>
  );
}

/** Money received and returned, with a receipt for each payment. */
export function PaymentHistory({
  payments,
  part,
}: {
  payments: PaymentWithRefunds[];
  part: "order" | "booking";
}) {
  const done = payments.filter((p) => p.status === "completed");
  if (!done.length) return null;
  const amount = (p: { orderPence: number; bookingPence: number }) =>
    part === "order" ? p.orderPence : p.bookingPence;
  return (
    <div className="card">
      <h2 className="mb-2 font-display text-2xl">Payments</h2>
      <ul className="divide-y divide-line text-sm">
        {done.map((p) => (
          <li key={p.id} className="py-3">
            <div className="flex flex-wrap justify-between gap-2">
              <span>
                {formatShortDate(p.completedAt ?? p.createdAt)} · {label(p.method)}
              </span>
              <span className="font-semibold">{formatPence(amount(p))}</span>
            </div>
            {p.refunds
              .filter((r) => amount(r) > 0)
              .map((r) => (
                <div key={r.id} className="flex justify-between text-muted">
                  <span>Refunded {formatShortDate(r.createdAt)}</span>
                  <span>-{formatPence(amount(r))}</span>
                </div>
              ))}
            <Link href={`/receipt/${manageToken("payment", p)}`} prefetch={false} className="link text-xs">
              Receipt {p.reference}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A link to finish a checkout that is still waiting for money. */
function PayNow({ payments }: { payments: PaymentWithRefunds[] }) {
  const waiting = payments.find((p) => p.status === "pending" && p.purpose === "checkout");
  if (!waiting) return null;
  return (
    <div className="card border-amber-300 bg-amber-50">
      <p className="mb-3 text-sm">
        Payment of <strong>{formatPence(waiting.amountPence)}</strong> is needed
        {waiting.expiresAt && ` by ${formatDateTime(waiting.expiresAt)}`} to confirm.
      </p>
      <Link href={`/pay/${manageToken("payment", waiting)}`} prefetch={false} className="btn btn-primary">
        Pay now
      </Link>
    </div>
  );
}

/** Used both by the account area and by guests' private links. */
export async function BookingDetail({ booking, access }: { booking: Booking; access: Access }) {
  // The caller must already have proved ownership.
  const settings = await readSettings();
  const now = new Date();
  const open = ["requested", "confirmed", "pending_payment"].includes(booking.status);
  const canChange = canCustomerModify(booking, settings.cancellationNoticeHours, now);
  const [review] = await db.select().from(reviews).where(eq(reviews.bookingId, booking.id));
  const addons = await db
    .select()
    .from(bookingAddons)
    .where(eq(bookingAddons.bookingId, booking.id))
    .orderBy(asc(bookingAddons.id));
  const photos = await db.select().from(bookingImages).where(eq(bookingImages.bookingId, booking.id));
  const [linked] = await db.select().from(orders).where(eq(orders.bookingId, booking.id));
  const payments = await paymentsFor({ bookingId: booking.id });
  const owed = balanceDue(booking);
  const window = bookingWindow(now, settings);
  const query = "token" in access ? `token=${encodeURIComponent(access.token)}` : `id=${access.id}`;

  const rows: [string, React.ReactNode][] = [
    ["Reference", booking.reference],
    ["Status", <StatusBadge key="s" status={booking.status} />],
    ["Service", booking.serviceName],
    ["With", booking.staffName],
    ["When", formatDateTime(booking.startsAt)],
    [
      "Where",
      booking.locationType === "mobile"
        ? [booking.addressLine1, booking.addressLine2, booking.city, booking.postcode]
            .filter(Boolean)
            .join("\n")
        : settings.address || "At the salon",
    ],
    ["Price", formatPence(booking.pricePence)],
    ...addons.map((a): [string, string] => [`Extra: ${a.name}`, formatPence(a.pricePence)]),
  ];
  if (booking.travelFeePence) rows.push(["Travel fee", formatPence(booking.travelFeePence)]);
  if (booking.discountPence) {
    rows.push([`Discount ${booking.discountCode}`, `-${formatPence(booking.discountPence)}`]);
  }
  rows.push(["Total", <strong key="t">{formatPence(booking.totalPence)}</strong>]);
  if (owed) rows.push(["Still to pay", <strong key="o">{formatPence(owed)}</strong>]);
  if (booking.notes) rows.push(["Your notes", booking.notes]);
  if (photos.length) rows.push(["Reference photos", `${photos.length} sent to the salon`]);

  return (
    <div className="space-y-5">
      {booking.status === "requested" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          We are reviewing your request and will email you. Nothing has been charged.
        </p>
      )}
      <PayNow payments={payments} />
      <div className="card">
        <DetailList rows={rows} />
        {booking.status === "confirmed" && (
          <a download href={`/api/bookings/ics?${query}`} className="btn btn-outline btn-sm mt-4">
            <CalendarPlus size={14} /> Add to calendar
          </a>
        )}
        {owed > 0 && (
          <ActionForm action={payBalance.bind(null, access)} className="mt-3">
            <SubmitButton>Pay {formatPence(owed)} online</SubmitButton>
          </ActionForm>
        )}
      </div>

      {linked && !["expired", "cancelled"].includes(linked.status) && (
        <div className="card flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>
            Products with this booking: order <strong>{linked.number}</strong>{" "}
            <StatusBadge status={linked.status} />
          </span>
          <Link
            href={
              "token" in access
                ? `/manage/order/${manageToken("order", linked)}`
                : `/account/orders/${linked.id}`
            }
            prefetch={false}
            className="link"
          >
            View order
          </Link>
        </div>
      )}

      <PaymentHistory payments={payments} part="booking" />

      {open && canChange && (
        <>
          {booking.status === "confirmed" && <ReschedulePanel access={access} window={window} />}
          <ActionForm
            action={customerCancelBooking.bind(null, access)}
            confirm={booking.status === "requested" ? "Withdraw this request?" : "Cancel this booking?"}
            className="space-y-3"
          >
            <SubmitButton className="btn btn-danger">
              {booking.status === "requested" ? "Withdraw request" : "Cancel booking"}
            </SubmitButton>
          </ActionForm>
        </>
      )}
      {open && !canChange && booking.startsAt > now && (
        <p className="rounded-lg bg-sand px-4 py-3 text-sm">
          Online changes close {settings.cancellationNoticeHours} hours before your visit. Please
          contact the salon{settings.phone ? ` on ${settings.phone}` : ""}.
        </p>
      )}
      <p className="text-xs text-muted">
        {settings.cancellationPolicy}{" "}
        <Link href="/cancellation-policy" prefetch={false} className="link">
          Full policy
        </Link>
      </p>

      {booking.status === "completed" && (
        <div className="card">
          <h2 className="mb-3 font-display text-2xl">How was your visit?</h2>
          {review ? (
            <ExistingReview rating={review.rating} status={review.status} />
          ) : (
            <ReviewForm target={{ kind: "booking", access }} />
          )}
        </div>
      )}
    </div>
  );
}

export async function OrderDetail({
  order,
  access,
}: {
  order: Order & { items: OrderItem[] };
  access: Access;
}) {
  const reviewable = PAID_ORDER_STATUSES.includes(order.status);
  const mine = reviewable
    ? await db.select().from(reviews).where(eq(reviews.orderId, order.id))
    : [];
  const payments = await paymentsFor({ orderId: order.id });
  const rows: [string, React.ReactNode][] = [
    ["Order", order.number],
    ["Placed", formatShortDate(order.createdAt)],
    ["Status", <StatusBadge key="s" status={order.status} />],
    [
      order.fulfilment === "delivery" ? order.deliveryMethodName || "Deliver to" : "Collection",
      order.fulfilment === "delivery"
        ? [order.addressLine1, order.addressLine2, order.city, order.postcode]
            .filter(Boolean)
            .join("\n")
        : order.fulfilment === "pickup"
          ? "Collect from the salon"
          : "At your appointment",
    ],
  ];
  if (order.trackingInfo) rows.push(["Tracking", order.trackingInfo]);

  return (
    <div className="space-y-5">
      <PayNow payments={payments} />
      <div className="card">
        <DetailList rows={rows} />
      </div>
      <div className="card space-y-5">
        {order.items.map((item) => {
          const review = mine.find((r) => r.productId === item.productId);
          return (
            <div key={item.id} className="border-b border-line pb-5 last:border-0 last:pb-0">
              <div className="flex gap-4">
                <Photo src={item.imagePath} alt={item.name} className="size-16 shrink-0 rounded-lg" sizes="64px" />
                <div className="flex-1">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-muted">
                    {item.variantLabel && `${item.variantLabel} · `}
                    {item.quantity} × {formatPence(item.unitPricePence)}
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  {formatPence(item.quantity * item.unitPricePence)}
                </p>
              </div>
              {reviewable && item.productId !== null && (
                <div className="mt-3">
                  {review ? (
                    <ExistingReview rating={review.rating} status={review.status} />
                  ) : (
                    <details>
                      <summary className="link cursor-pointer text-sm">Write a review</summary>
                      <div className="mt-3">
                        <ReviewForm
                          target={{ kind: "order", access, productId: item.productId }}
                        />
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <DetailList
          rows={[
            ["Subtotal", formatPence(order.subtotalPence)],
            ["Delivery", order.deliveryPence ? formatPence(order.deliveryPence) : "Free"],
            ...(order.discountPence
              ? ([[`Discount ${order.discountCode}`, `-${formatPence(order.discountPence)}`]] as [
                  string,
                  string,
                ][])
              : []),
            ["Total", <strong key="t">{formatPence(order.totalPence)}</strong>],
          ]}
        />
      </div>
      <PaymentHistory payments={payments} part="order" />
    </div>
  );
}
