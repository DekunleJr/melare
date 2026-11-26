import type { Metadata } from "next";
import { MapEmbed } from "@/components/site/consent";
import { ActionForm, Field, Honeypot, SubmitButton, TextArea } from "@/components/ui/form";
import { DetailList, PageHero } from "@/components/ui/misc";
import { getSettings } from "@/features/content/queries";
import { sendContactMessage } from "@/features/site/actions";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const s = await getSettings();
  const rows = [
    ["Address", s.address],
    ["Phone", s.phone],
    ["Email", s.publicEmail],
    ["Opening hours", s.openingHours],
  ].filter(([, value]) => value) as [string, string][];

  return (
    <>
      <PageHero eyebrow="Say hello" title="Contact us" />
      <div className="container-page grid gap-10 py-14 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="card">
            <DetailList rows={rows} />
          </div>
          {s.address && <MapEmbed address={s.address} title={`Map showing ${s.businessName}`} />}
        </div>
        <div className="card h-fit">
          <h2 className="mb-4 font-display text-2xl">Send a message</h2>
          <ActionForm action={sendContactMessage} className="relative grid gap-4 sm:grid-cols-2" resetOnSuccess>
            <Honeypot />
            <Field name="name" label="Name" autoComplete="name" required />
            <Field name="email" label="Email" type="email" autoComplete="email" required />
            <Field name="phone" label="Phone (optional)" type="tel" autoComplete="tel" />
            <Field name="subject" label="Subject" required />
            <TextArea name="message" label="Message" rows={6} required maxLength={3000} wrapperClass="sm:col-span-2" />
            <div className="sm:col-span-2">
              <SubmitButton>Send message</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </div>
    </>
  );
}
