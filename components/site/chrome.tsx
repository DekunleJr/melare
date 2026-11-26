import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { ActionForm, Field, Honeypot, SubmitButton } from "@/components/ui/form";
import { getSettings } from "@/features/content/queries";
import { subscribe } from "@/features/site/actions";
import { TAGS } from "@/lib/tags";
import { CartLink } from "./cart-ui";
import { CookieSettingsButton } from "./consent";
import { AccountLink, MobileMenu } from "./nav";

export const NAV_LINKS = [
  { href: "/services", label: "Services" },
  { href: "/shop", label: "Shop" },
  { href: "/team", label: "Team" },
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export async function Header() {
  const settings = await getSettings();
  return (
    <>
      {settings.announcement && (
        <p className="bg-ink px-4 py-2 text-center text-sm text-cream">{settings.announcement}</p>
      )}
      <header className="sticky top-0 z-40 border-b border-line bg-cream/90 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link href="/" className="min-w-0 truncate font-display text-lg tracking-wide uppercase sm:text-2xl sm:tracking-[0.12em]">
            {settings.businessName}
          </Link>
          <nav aria-label="Main" className="hidden gap-5 text-sm lg:flex xl:gap-7">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-clay">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1 sm:gap-3">
            <span className="hidden sm:block">
              <AccountLink />
            </span>
            <CartLink />
            <Link href="/book" className="btn btn-primary btn-sm whitespace-nowrap">
              Book now
            </Link>
            <MobileMenu links={[...NAV_LINKS, { href: "/account", label: "My account" }]} />
          </div>
        </div>
      </header>
    </>
  );
}

const socialUrl = (value: string, base: string) =>
  value.startsWith("http") ? value : `${base}${value.replace(/^@/, "")}`;

export async function Footer() {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife("hours");
  const s = await getSettings();
  const socials = [
    s.instagram && ["Instagram", socialUrl(s.instagram, "https://instagram.com/")],
    s.facebook && ["Facebook", socialUrl(s.facebook, "https://facebook.com/")],
    s.tiktok && ["TikTok", socialUrl(s.tiktok, "https://tiktok.com/@")],
  ].filter(Boolean) as [string, string][];
  const whatsapp = s.whatsapp.replace(/\D/g, "");

  return (
    <>
      <footer className="mt-auto border-t border-line bg-ink text-cream">
        <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-2xl tracking-[0.15em] uppercase">{s.businessName}</p>
            <p className="mt-2 text-sm text-cream/70">{s.tagline}</p>
            <p className="mt-4 text-sm whitespace-pre-line text-cream/70">
              {[s.address, s.phone, s.publicEmail].filter(Boolean).join("\n")}
            </p>
          </div>
          <div>
            <p className="eyebrow text-cream/60">Opening hours</p>
            <p className="text-sm leading-7 whitespace-pre-line text-cream/80">{s.openingHours}</p>
          </div>
          <nav aria-label="Footer" className="text-sm">
            <p className="eyebrow text-cream/60">Explore</p>
            <ul className="space-y-2 text-cream/80">
              {[
                ...NAV_LINKS,
                { href: "/faq", label: "FAQs" },
                { href: "/delivery", label: "Delivery" },
                { href: "/returns", label: "Returns" },
                { href: "/cancellation-policy", label: "Booking cancellations" },
                { href: "/privacy", label: "Privacy" },
                { href: "/terms", label: "Terms" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="eyebrow text-cream/60">News and offers</p>
            <ActionForm action={subscribe} className="relative space-y-3 text-ink" resetOnSuccess>
              <Honeypot />
              <Field name="email" type="email" label="" aria-label="Email address" placeholder="Your email" required />
              <SubmitButton className="btn btn-primary btn-sm">Subscribe</SubmitButton>
            </ActionForm>
            {socials.length > 0 && (
              <ul className="mt-5 flex gap-4 text-sm text-cream/80">
                {socials.map(([name, url]) => (
                  <li key={name}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <p className="border-t border-white/10 py-5 text-center text-xs text-cream/70">
          © {new Date().getFullYear()} {s.businessName}. <CookieSettingsButton />
        </p>
      </footer>
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed right-4 bottom-4 z-30 rounded-full bg-[#1f7a4d] px-5 py-3 text-sm font-semibold text-white shadow-lg"
        >
          WhatsApp us
        </a>
      )}
    </>
  );
}
