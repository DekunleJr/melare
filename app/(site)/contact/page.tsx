import { CalendarCheck, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { socialLinks } from "@/components/site/chrome";
import { MapEmbed } from "@/components/site/consent";
import { PhotoBanner } from "@/components/site/photo-banner";
import { ActionForm, Field, Honeypot, SubmitButton, TextArea } from "@/components/ui/form";
import { Photo, SectionTitle } from "@/components/ui/misc";
import { getFaqs, getSettings } from "@/features/content/queries";
import { sendContactMessage } from "@/features/site/actions";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const [s, faqs] = await Promise.all([getSettings(), getFaqs()]);
  const whatsapp = s.whatsapp.replace(/\D/g, "");
  const socials = socialLinks(s);
  const hours = s.openingHours
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [day, ...rest] = line.split(":");
      return { day, time: rest.join(":").trim() };
    });

  // Only the ways of getting in touch that have been filled in under Admin > Settings are shown.
  const ways = [
    { icon: CalendarCheck, title: "Book online", text: "Choose a treatment, stylist and time", href: "/book" },
    { icon: Send, title: "Send a message", text: "Use the form on this page", href: "#message" },
    s.phone && { icon: Phone, title: "Call us", text: s.phone, href: `tel:${s.phone.replace(/[^\d+]/g, "")}` },
    whatsapp && { icon: MessageCircle, title: "WhatsApp", text: "Chat with us", href: `https://wa.me/${whatsapp}` },
    s.publicEmail && { icon: Mail, title: "Email", text: s.publicEmail, href: `mailto:${s.publicEmail}` },
    s.address && { icon: MapPin, title: "Visit us", text: s.address, href: "#find-us" },
  ].filter((way) => !!way);

  return (
    <>
      <PhotoBanner image="/images/contact-banner.jpg" eyebrow="Say hello" title="Contact us">
        <p>
          A question about a style, a booking or an order? Tell us what you need and we will get back
          to you.
        </p>
      </PhotoBanner>

      <section aria-label="Ways to reach us" className="container-page py-12">
        <ul className="flex flex-wrap justify-center gap-4">
          {ways.map(({ icon: Icon, title, text, href }) => (
            <li key={title} className="w-full sm:w-64">
              <a
                href={href}
                {...(href.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="card flex h-full flex-col items-center text-center transition-colors hover:border-gold-dark"
              >
                <span className="grid size-12 place-items-center rounded-full bg-gold text-black">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="mt-3 font-display text-2xl text-chocolate">{title}</span>
                <span className="mt-1 text-sm break-words whitespace-pre-line text-muted [overflow-wrap:anywhere]">{text}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section id="message" className="scroll-mt-24 border-y border-line bg-white py-16">
        <div className="container-page grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <p className="eyebrow">Write to us</p>
            <h2 className="mb-6 font-display text-4xl">Send a message</h2>
            <div className="card">
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
          <div className="lg:col-span-2">
            <Photo
              src="/images/contact-portrait.jpg"
              alt="A woman with long twisted braids"
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="mx-auto aspect-[4/5] h-full w-full max-w-md rounded-t-[10rem] rounded-b-3xl lg:aspect-auto lg:min-h-[32rem] lg:max-w-none"
            />
          </div>
        </div>
      </section>

      <section id="find-us" className="container-page grid scroll-mt-24 items-start gap-10 py-16 lg:grid-cols-2">
        <div className="on-dark rounded-3xl bg-black p-6 text-cream sm:p-8">
          <p className="eyebrow text-gold">When to find us</p>
          <h2 className="mb-5 font-display text-4xl text-cream">Opening hours</h2>
          <dl className="divide-y divide-white/10">
            {hours.map(({ day, time }) => (
              <div key={day} className="flex justify-between gap-6 py-3 text-sm">
                <dt>{day}</dt>
                <dd className="text-right text-cream/75">{time}</dd>
              </div>
            ))}
          </dl>
          {socials.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-3">
              {socials.map(([name, url]) => (
                <li key={name}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-sm border-cream/50 text-cream hover:bg-white/10">
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {s.address ? (
          <div className="space-y-4">
            <p className="eyebrow">Find us</p>
            <p className="whitespace-pre-line">{s.address}</p>
            <MapEmbed address={s.address} title={`Map showing ${s.businessName}`} />
          </div>
        ) : (
          <div className="rounded-3xl bg-sand p-6 sm:p-8">
            <p className="eyebrow">Before you visit</p>
            <h2 className="font-display text-4xl">Plan your appointment</h2>
            <p className="mt-4 leading-7">
              Booking online is the quickest way to secure your time. You can see prices, how long
              each service takes and which stylists are free.
            </p>
            <p className="mt-3 text-sm leading-7 text-muted">{s.cancellationPolicy}</p>
            <Link href="/book" className="btn btn-primary mt-7">
              Book an appointment
            </Link>
          </div>
        )}
      </section>

      {faqs.length > 0 && (
        <section className="border-t border-line py-16">
          <div className="container-page max-w-3xl">
            <SectionTitle eyebrow="Good to know" title="Quick answers" href="/faq" linkLabel="All questions" />
            <div className="space-y-3">
              {faqs.slice(0, 4).map((faq) => (
                <details key={faq.id} className="card">
                  <summary className="cursor-pointer font-semibold">{faq.question}</summary>
                  <p className="mt-3 text-sm leading-7 whitespace-pre-line text-muted">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
