import type { Metadata } from "next";
import { ContentPage } from "@/components/site/content-page";

export const metadata: Metadata = { title: "Returns and refunds" };

export default function Page() {
  return <ContentPage slug="returns" />;
}
