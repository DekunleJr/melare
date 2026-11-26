import type { Metadata } from "next";
import { ContentPage } from "@/components/site/content-page";

export const metadata: Metadata = { title: "Delivery" };

export default function Page() {
  return <ContentPage slug="delivery" />;
}
