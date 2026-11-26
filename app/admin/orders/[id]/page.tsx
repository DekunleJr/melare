import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PaymentTable, RefundForm } from "@/components/admin/payment-parts";
import { ActionButton, AdminHeader, Table, BackButton } from "@/components/admin/ui";
import { ActionForm, Checkbox, Field, Select, SubmitButton } from "@/components/ui/form";
import { DetailList, StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import {
  cancelAndRefundOrder,
  cancelPendingOrder,
  refundOrderAmount,
  setOrderStatus,
} from "@/features/admin/sales-actions";
import { allowedNextStatuses, getOrder, PAID_ORDER_STATUSES } from "@/features/orders/service";
import { paymentsFor } from "@/features/payments/ledger";
import { label } from "@/lib/labels";
import { formatPence } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Order" };

export default async function OrderAdminPage({ params }: PageProps<"/admin/orders/[id]">) {
  await connection();
  await requireAdmin();
  const order = await getOrder(Number((await params).id) || 0);
  if (!order) notFound();
  const payments = await paymentsFor({ orderId: order.id });
  const [booking] = order.bookingId
    ? await db.select().from(bookings).where(eq(bookings.id, order.bookingId))
    : [];
  const next = allowedNextStatuses(order);
  const paid = PAID_ORDER_STATUSES.includes(order.status);
  const refundable = payments.reduce((n, p) => n + p.orderLeft, 0);

  return (
    <>
      {/* Outside the narrow column, so the buttons sit at the right edge of the page. */}
      <AdminHeader title={`Order ${order.number}`}>
        <StatusBadge status={order.status} />
        <BackButton href="/admin/orders" />
      </AdminHeader>
      <div className="max-w-3xl space-y-6">
        <div className="card">
          <DetailList
            rows={[
              ["Placed", formatDateTime(order.createdAt)],
              ["Paid", order.paidAt ? formatDateTime(order.paidAt) : "Not paid"],
              ["Customer", order.customerName],
              ["Email", <a key="e" className="link" href={`mailto:${order.customerEmail}`}>{order.customerEmail}</a>],
              ["Phone", <a key="p" className="link" href={`tel:${order.customerPhone}`}>{order.customerPhone}</a>],
              ["Account", order.userId ? "Registered customer" : "Guest"],
              ["Method", order.deliveryMethodName || label(order.fulfilment)],
              ...(order.fulfilment === "delivery"
                ? ([["Address", [order.addressLine1, order.addressLine2, order.city, order.postcode].filter(Boolean).join("\n")]] as [string, string][])
                : []),
              ...(booking
                ? ([
                    [
                      "Appointment",
                      <Link key="b" href={`/admin/bookings/${booking.id}`} prefetch={false} className="link">
                        {booking.reference}, {formatDateTime(booking.startsAt)} ({label(booking.status)})
                      </Link>,
                    ],
                  ] as [string, React.ReactNode][])
                : []),
              ["Notes", order.notes || "—"],
            ]}
          />
        </div>
        <Table head={["Item", "Price", "Qty", "Total"]} empty="No items.">
          {order.items.map((i) => (
            <tr key={i.id}>
              <td>
                {i.name}
                {i.variantLabel && <span className="block text-xs text-muted">{i.variantLabel}</span>}
              </td>
              <td>{formatPence(i.unitPricePence)}</td>
              <td>{i.quantity}</td>
              <td>{formatPence(i.unitPricePence * i.quantity)}</td>
            </tr>
          ))}
        </Table>
        <div className="card">
          <DetailList
            rows={[
              ["Subtotal", formatPence(order.subtotalPence)],
              ["Delivery", formatPence(order.deliveryPence)],
              [`Discount ${order.discountCode}`, `-${formatPence(order.discountPence)}`],
              ["Total", <strong key="t">{formatPence(order.totalPence)}</strong>],
              ["Refunded", formatPence(order.refundedPence)],
            ]}
          />
        </div>

        <PaymentTable payments={payments} part="order" />

        {paid && (
          <section className="card">
            <h2 className="mb-3 font-display text-2xl">Dispatch and fulfilment</h2>
            <ActionForm action={setOrderStatus.bind(null, order.id)} className="grid gap-3 sm:grid-cols-2">
              <Select name="status" label="Status" defaultValue={next[0] ?? order.status}>
                {[order.status, ...next].map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </Select>
              <Field name="trackingInfo" label="Tracking number or link" defaultValue={order.trackingInfo} />
              <div className="sm:col-span-2">
                <SubmitButton>Update order</SubmitButton>
              </div>
            </ActionForm>
          </section>
        )}

        {paid && (
          <section className="card">
            <h2 className="mb-3 font-display text-2xl">Cancel order</h2>
            <ActionForm action={cancelAndRefundOrder.bind(null, order.id)} confirm="Cancel this order and refund the customer?" className="space-y-3">
              <Checkbox name="restock" label="Return the items to stock" defaultChecked={order.status !== "shipped" && order.status !== "completed"} />
              <SubmitButton className="btn btn-danger">
                Cancel and refund {formatPence(refundable)}
              </SubmitButton>
            </ActionForm>
          </section>
        )}

        {refundable > 0 && (
          <RefundForm action={refundOrderAmount.bind(null, order.id)} available={refundable} />
        )}

        {order.status === "pending" && !order.bookingId && (
          <ActionButton action={cancelPendingOrder.bind(null, order.id)} confirm="Cancel this unpaid order?" danger>
            Cancel unpaid order
          </ActionButton>
        )}
      </div>
    </>
  );
}
