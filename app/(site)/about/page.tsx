import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/ui/misc";
import { getSettings } from "@/features/content/queries";

export const metadata: Metadata = { title: "About us" };

export default async function AboutPage() {
  const s = await getSettings();
  return (
    <>
      <PageHero eyebrow="Our story" title={`About ${s.businessName}`} />
      <div className="container-page max-w-3xl py-14 text-center">
        <p className="text-lg leading-9 whitespace-pre-line">{s.aboutText}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/book" className="btn btn-primary">
            Book a visit
          </Link>
          <Link href="/team" className="btn btn-outline">
            Meet the team
          </Link>
        </div>
      </div>
    </>
  );
}
