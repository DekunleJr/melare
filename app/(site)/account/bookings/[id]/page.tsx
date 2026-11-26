import { notFound } from "next/navigation";
import { BookingDetail } from "@/components/site/details";
import { accessBooking } from "@/features/access";
import { requireUser } from "@/lib/session";

export default async function MyBookingPage({ params }: PageProps<"/account/bookings/[id]">) {
  const id = Number((await params).id);
  await requireUser(`/account/bookings/${id || ""}`);
  const booking = await accessBooking({ id });
  if (!booking) notFound();
  return (
    <>
      <h1 className="mb-6 font-display text-4xl">{booking.serviceName}</h1>
      <BookingDetail booking={booking} access={{ id }} />
    </>
  );
}
