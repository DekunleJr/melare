import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PaymentTable, RefundForm } from "@/components/admin/payment-parts";
import { ActionButton, AdminHeader } from "@/components/admin/ui";
import { ActionForm, Checkbox, Field, Select, SubmitButton } from "@/components/ui/form";
import { DetailList, StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import { bookingAddons, bookingImages, orders } from "@/db/schema";
import {
  adminCancelBooking,
  adminReschedule,
  approveRequest,
  declineRequest,
  recordBookingPayment,
  refundBookingAmount,
  sendBalanceRequest,
  setBookingOutcome,
} from "@/features/admin/sales-actions";
import { getBooking } from "@/features/bookings/service";
import { balanceDue, paymentsFor } from "@/features/payments/ledger";
import { label } from "@/lib/labels";
import { formatPence, penceToInput } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { formatDateTime, formatTime } from "@/lib/time";
import { manageUrl } from "@/lib/tokens";

export const metadata = { title: "Booking" };

export default async function BookingAdminPage({ params }: PageProps<"/admin/bookings/[id]">) {
  await connection();
  await requireAdmin();
  const booking = await getBooking(Number((await params).id) || 0);
  if (!booking) notFound();
  const { id, status } = booking;
  const [addons, photos, [order], payments] = await Promise.all([
    db.select().from(bookingAddons).where(eq(bookingAddons.bookingId, id)).orderBy(asc(bookingAddons.id)),
    db.select().from(bookingImages).where(eq(bookingImages.bookingId, id)),
    db.select().from(orders).where(eq(orders.bookingId, id)),
    paymentsFor({ bookingId: id }),
  ]);
  const open = ["requested", "confirmed", "pending_payment"].includes(status);
  const refundable = payments.reduce((n, p) => n + p.bookingLeft, 0);
  const owed = balanceDue(booking);
  const started = booking.startsAt <= new Date();
  const waiting = payments.find((p) => p.status === "pending");
  const address = [booking.addressLine1, booking.addressLine2, booking.city, booking.postcode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="max-w-3xl space-y-6">
      <AdminHeader title={`Booking ${booking.reference}`}>
        <StatusBadge status={status} />
      </AdminHeader>

      {status === "requested" && (
        <section className="card border-amber-300 bg-amber-50">
          <h2 className="font-display text-2xl">Approve this request?</h2>
          <p className="mb-3 text-sm">
            Reply by {booking.holdExpiresAt && formatDateTime(booking.holdExpiresAt)}. If money is
            due, the customer is emailed a payment link when you approve.
          </p>
          <div className="flex flex-wrap gap-3">
            <ActionButton action={approveRequest.bind(null, id)}>Approve</ActionButton>
            <ActionButton action={declineRequest.bind(null, id)} confirm="Decline this request?" danger>
              Decline
            </ActionButton>
          </div>
        </section>
      )}

      <div className="card">
        <DetailList
          rows={[
            ["Service", booking.serviceName],
            ["With", booking.staffName],
            ["When", `${formatDateTime(booking.startsAt)} – ${formatTime(booking.endsAt)}`],
            [
              "Where",
              booking.locationType === "mobile" ? (
                <a key="w" className="link" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps?q=${encodeURIComponent(address)}`}>
                  {address}
                </a>
              ) : (
                "Salon"
              ),
            ],
            ...(booking.travelMinutes
              ? ([["Travel time blocked", `${booking.travelMinutes} min each way`]] as [string, string][])
              : []),
            ["Customer", booking.customerName],
            ["Email", <a key="e" className="link" href={`mailto:${booking.customerEmail}`}>{booking.customerEmail}</a>],
            ["Phone", <a key="p" className="link" href={`tel:${booking.customerPhone}`}>{booking.customerPhone}</a>],
            ["Account", booking.userId ? "Registered customer" : "Guest"],
            ["Notes", booking.notes || "—"],
            ["Booked on", formatDateTime(booking.createdAt)],
          ]}
        />
        {photos.length > 0 && (
          <div className="mt-4">
            <p className="label">Reference photos</p>
            <div className="flex flex-wrap gap-3">
              {photos.map((photo, i) => (
                <a key={photo.id} href={`/api/admin/booking-images/${photo.id}`} target="_blank" rel="noopener noreferrer">
                  {/* Private file behind an admin check, so not run through the image optimiser. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/admin/booking-images/${photo.id}`} alt={`Reference ${i + 1}`} className="size-32 rounded-xl object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="mb-2 font-display text-2xl">Charges</h2>
        <DetailList
          rows={[
            ["Service", formatPence(booking.pricePence)],
            ...addons.map((a): [string, string] => [`Extra: ${a.name}`, formatPence(a.pricePence)]),
            ...(booking.travelFeePence
              ? ([["Travel fee", formatPence(booking.travelFeePence)]] as [string, string][])
              : []),
            ...(booking.discountPence
              ? ([[`Discount ${booking.discountCode}`, `-${formatPence(booking.discountPence)}`]] as [string, string][])
              : []),
            ["Total", <strong key="t">{formatPence(booking.totalPence)}</strong>],
            ["Payment", label(booking.paymentStatus)],
            ["Received", formatPence(booking.paidPence)],
            ["Refunded", formatPence(booking.refundedPence)],
            ["Outstanding", <strong key="o">{formatPence(owed)}</strong>],
          ]}
        />
      </div>

      {order && (
        <p className="card text-sm">
          Products with this booking:{" "}
          <Link href={`/admin/orders/${order.id}`} prefetch={false} className="link">
            order {order.number}
          </Link>{" "}
          <StatusBadge status={order.status} />
        </p>
      )}

      {waiting && (
        <div className="card text-sm">
          <p className="mb-2">
            Waiting for {formatPence(waiting.amountPence)}
            {waiting.expiresAt && ` until ${formatDateTime(waiting.expiresAt)}`}. Payment link:
          </p>
          <input className="input" readOnly value={manageUrl("payment", waiting)} aria-label="Payment link" />
        </div>
      )}

      <PaymentTable payments={payments} part="booking" />

      {owed > 0 && (
        <section className="card space-y-5">
          <h2 className="font-display text-2xl">Outstanding balance: {formatPence(owed)}</h2>
          <ActionForm action={recordBookingPayment.bind(null, id)} className="grid gap-3 sm:grid-cols-3">
            <Field name="amount" label="Amount received (£)" inputMode="decimal" required defaultValue={penceToInput(owed)} />
            <Select name="method" label="Paid by">
              <option value="cash">Cash</option>
              <option value="card_in_salon">Card reader</option>
              <option value="bank_transfer">Bank transfer</option>
            </Select>
            <Field name="note" label="Note" />
            <div className="sm:col-span-3">
              <SubmitButton>Record payment</SubmitButton>
            </div>
          </ActionForm>
          <ActionButton action={sendBalanceRequest.bind(null, id)}>Email an online payment link</ActionButton>
        </section>
      )}

      {status === "confirmed" && started && (
        <div className="flex gap-3">
          <ActionButton action={setBookingOutcome.bind(null, id, "completed")}>Mark completed</ActionButton>
          <ActionButton action={setBookingOutcome.bind(null, id, "no_show")} danger>Mark no show</ActionButton>
        </div>
      )}

      {status === "confirmed" && (
        <section className="card">
          <h2 className="mb-3 font-display text-2xl">Move appointment</h2>
          <ActionForm action={adminReschedule.bind(null, id)} className="flex flex-wrap items-end gap-3">
            <Field name="start" label={`New time with ${booking.staffName}`} type="datetime-local" required />
            <SubmitButton className="btn btn-outline">Move</SubmitButton>
          </ActionForm>
        </section>
      )}

      {open && status !== "requested" && (
        <section className="card">
          <h2 className="mb-3 font-display text-2xl">Cancel booking</h2>
          <ActionForm action={adminCancelBooking.bind(null, id)} confirm="Cancel this booking and email the customer?" className="space-y-3">
            {refundable > 0 && (
              <Checkbox name="refund" label={`Refund ${formatPence(refundable)}`} defaultChecked />
            )}
            <SubmitButton className="btn btn-danger">Cancel booking</SubmitButton>
          </ActionForm>
        </section>
      )}

      {refundable > 0 && (
        <RefundForm action={refundBookingAmount.bind(null, id)} available={refundable} />
      )}
    </div>
  );
}
