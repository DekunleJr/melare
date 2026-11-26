import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { ActionForm, Field, Honeypot, SubmitButton } from "@/components/ui/form";
import { getSettings } from "@/features/content/queries";
import { subscribe } from "@/features/site/actions";
import { TAGS } from "@/lib/tags";
import { NavLink } from "@/components/ui/nav-link";
import { CartLink } from "./cart-ui";
import { CookieSettingsButton } from "./consent";
import { Logo } from "./logo";
import { AccountLink, MobileMenu } from "./nav";

export const NAV_LINKS = [
  { href: "/services", label: "Services" },
  { href: "/shop", label: "Shop" },
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
        <p className="bg-chocolate px-4 py-2 text-center text-sm text-cream">{settings.announcement}</p>
      )}
      <header className="on-dark sticky top-0 z-40 border-b border-white/10 bg-black text-cream">
        <div className="container-page flex h-20 items-center justify-between gap-4">
          <Link href="/" className="shrink-0">
            <Logo name={settings.businessName} className="h-[4.5rem]" preload />
          </Link>
          <nav aria-label="Main" className="hidden gap-1 text-sm lg:flex xl:gap-3">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} className="rounded-full px-3 py-1.5 hover:text-gold">
                {link.label}
              </NavLink>
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

/** [name, url] for each social account filled in under Admin > Settings. */
export function socialLinks(s: { instagram: string; facebook: string; tiktok: string }) {
  return [
    s.instagram && ["Instagram", socialUrl(s.instagram, "https://instagram.com/")],
    s.facebook && ["Facebook", socialUrl(s.facebook, "https://facebook.com/")],
    s.tiktok && ["TikTok", socialUrl(s.tiktok, "https://tiktok.com/@")],
  ].filter(Boolean) as [string, string][];
}

export async function Footer() {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife("hours");
  const s = await getSettings();
  const socials = socialLinks(s);
  const whatsapp = s.whatsapp.replace(/\D/g, "");

  return (
    <>
      <footer className="on-dark mt-auto bg-black text-cream">
        <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_1fr]">
          <div>
            <Logo name={s.businessName} className="h-32" />
            <p className="mt-3 text-sm text-cream/70">{s.tagline}</p>
            <p className="mt-4 text-sm whitespace-pre-line text-cream/70">
              {[s.address, s.phone, s.publicEmail].filter(Boolean).join("\n")}
            </p>
          </div>
          <div>
            <p className="eyebrow text-gold">Opening hours</p>
            <p className="text-sm leading-7 whitespace-pre-line text-cream/80">{s.openingHours}</p>
          </div>
          <nav aria-label="Footer" className="text-sm">
            <p className="eyebrow text-gold">Explore</p>
            {/* Large screens fill six rows, then start a second column. Raise the row count if there are ever more than 12 links. */}
            <ul className="grid gap-x-6 gap-y-2 text-cream/80 lg:grid-flow-col lg:grid-cols-[auto_auto] lg:grid-rows-6 lg:justify-start">
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
            <p className="eyebrow text-gold">News and offers</p>
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
