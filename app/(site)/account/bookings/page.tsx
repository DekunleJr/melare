import Link from "next/link";
import { BookingList } from "@/components/site/history";
import { EmptyState } from "@/components/ui/misc";
import { getMyBookings } from "@/features/account/queries";

export default async function MyBookingsPage() {
  const bookings = (await getMyBookings()).filter((b) => b.status !== "expired" || b.paidPence);
  return (
    <>
      <h1 className="mb-6 font-display text-4xl">Your bookings</h1>
      {bookings.length ? (
        <BookingList bookings={bookings} />
      ) : (
        <EmptyState title="No bookings yet">
          <Link href="/book" className="link">
            Book an appointment
          </Link>
        </EmptyState>
      )}
    </>
  );
}
