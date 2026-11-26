import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHero } from "@/components/ui/misc";
import { getFaqs } from "@/features/content/queries";

export const metadata: Metadata = { title: "FAQs" };

export default async function FaqPage() {
  const faqs = await getFaqs();
  return (
    <>
      <PageHero eyebrow="Good to know" title="Frequently asked questions" />
      <div className="container-page max-w-3xl space-y-3 py-14">
        {!faqs.length && <EmptyState title="No questions yet" />}
        {faqs.map((faq) => (
          <details key={faq.id} className="card">
            <summary className="cursor-pointer font-semibold">{faq.question}</summary>
            <p className="mt-3 text-sm leading-7 whitespace-pre-line text-muted">{faq.answer}</p>
          </details>
        ))}
        <p className="pt-4 text-center text-sm">
          Still wondering?{" "}
          <Link href="/contact" className="link">
            Get in touch
          </Link>
        </p>
      </div>
    </>
  );
}
