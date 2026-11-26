import Link from "next/link";
import { connection } from "next/server";
import { BookingList, OrderList } from "@/components/site/history";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { getMyBookings, getMyOrders } from "@/features/account/queries";
import { PAID_ORDER_STATUSES } from "@/features/orders/service";
import { requireUser } from "@/lib/session";

export default async function AccountPage() {
  await connection();
  const user = await requireUser();
  const [orders, bookings] = await Promise.all([getMyOrders(), getMyBookings()]);
  const now = new Date();
  const upcoming = bookings
    .filter((b) => b.status === "confirmed" && b.startsAt > now)
    .reverse();
  const purchases = orders.filter((o) => PAID_ORDER_STATUSES.includes(o.status));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-4xl">Hello, {user.name.split(" ")[0]}</h1>
        {user.role === "admin" && (
          <Link href="/admin" className="btn btn-primary btn-sm mt-3">
            Open admin dashboard
          </Link>
        )}
      </div>
      <section>
        <SectionTitle eyebrow="Appointments" title="Coming up" href="/account/bookings" linkLabel="All bookings" />
        {upcoming.length ? (
          <BookingList bookings={upcoming.slice(0, 3)} />
        ) : (
          <EmptyState title="No upcoming visits">
            <Link href="/book" className="link">
              Book an appointment
            </Link>
          </EmptyState>
        )}
      </section>
      <section>
        <SectionTitle eyebrow="Purchases" title="Products you have bought" href="/account/orders" linkLabel="All orders" />
        {purchases.length ? (
          <OrderList orders={purchases.slice(0, 3)} />
        ) : (
          <EmptyState title="Nothing bought yet">
            <Link href="/shop" className="link">
              Visit the shop
            </Link>
          </EmptyState>
        )}
      </section>
    </div>
  );
}
