import type { Metadata } from "next";
import { ContentPage } from "@/components/site/content-page";

export const metadata: Metadata = { title: "Booking cancellation policy" };

export default function Page() {
  return <ContentPage slug="cancellation-policy" />;
}
