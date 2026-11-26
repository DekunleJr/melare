import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookingDetail } from "@/components/site/details";
import { NewNotice } from "@/components/site/new-notice";
import { Loading } from "@/components/ui/misc";
import { accessBooking } from "@/features/access";

export const metadata: Metadata = { title: "Your booking", robots: { index: false } };

export default function ManageBookingPage({
  params,
  searchParams,
}: PageProps<"/manage/booking/[token]">) {
  return (
    <div className="container-page max-w-2xl py-12">
      <h1 className="mb-6 font-display text-4xl">Your booking</h1>
      <Suspense>
        {searchParams.then((query) => (
          <NewNotice kind="booking" isNew={query.new === "1"} usedBag={query.bag === "used"} />
        ))}
      </Suspense>
      <Suspense fallback={<Loading />}>
        {params.then(({ token }) => (
          <Booking token={decodeURIComponent(token)} />
        ))}
      </Suspense>
    </div>
  );
}

async function Booking({ token }: { token: string }) {
  const booking = await accessBooking({ token });
  if (!booking) notFound();
  return <BookingDetail booking={booking} access={{ token }} />;
}
