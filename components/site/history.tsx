import Link from "next/link";
import { StatusBadge } from "@/components/ui/misc";
import type { getMyBookings, getMyOrders } from "@/features/account/queries";
import { formatPence } from "@/lib/money";
import { formatDateTime, formatShortDate } from "@/lib/time";

export function OrderList({ orders }: { orders: Awaited<ReturnType<typeof getMyOrders>> }) {
  return (
    <ul className="space-y-3">
      {orders.map((order) => (
        <li key={order.id}>
          <Link href={`/account/orders/${order.id}`} prefetch={false} className="card block hover:border-clay">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold">
                {order.number}
                <span className="ml-2 text-sm font-normal text-muted">
                  {formatShortDate(order.createdAt)}
                </span>
              </p>
              <StatusBadge status={order.status} />
            </div>
            <p className="mt-2 text-sm text-muted">
              {order.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}
            </p>
            <p className="mt-1 text-sm font-semibold">{formatPence(order.totalPence)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function BookingList({ bookings }: { bookings: Awaited<ReturnType<typeof getMyBookings>> }) {
  return (
    <ul className="space-y-3">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <Link href={`/account/bookings/${booking.id}`} prefetch={false} className="card block hover:border-clay">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold">{booking.serviceName}</p>
              <StatusBadge status={booking.status} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {formatDateTime(booking.startsAt)} with {booking.staffName}
            </p>
            <p className="mt-1 text-sm font-semibold">{formatPence(booking.pricePence)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
