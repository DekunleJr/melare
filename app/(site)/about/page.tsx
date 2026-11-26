import type { Metadata } from "next";
import Link from "next/link";
import { ReviewList } from "@/components/site/cards";
import { PhotoBanner } from "@/components/site/photo-banner";
import { Photo, SectionTitle } from "@/components/ui/misc";
import { getReviews, getSettings, getTeam } from "@/features/content/queries";

export const metadata: Metadata = { title: "About us" };

const OFFERS = [
  {
    title: "Braiding",
    text: "Neat partings and protective styles, from classic cornrows to knotless braids.",
    image: "/images/about-braiding.jpg",
    alt: "Neatly parted braids seen from above",
    href: "/services",
    link: "Explore services",
  },
  {
    title: "Styling and colour",
    text: "A fresh finish for every day or a big occasion, or a new shade when you want a change.",
    image: "/images/about-styling.jpg",
    alt: "A stylist working on a client's hair in a bright salon",
    href: "/book",
    link: "Book a time",
  },
  {
    title: "Products and extensions",
    text: "Extensions, hair care and styling tools to keep your look going between visits.",
    image: "/images/about-products.jpg",
    alt: "Hair brush, comb, straighteners and dryer laid out on a white table",
    href: "/shop",
    link: "Visit the shop",
  },
];

export default async function AboutPage() {
  const [s, team, reviews] = await Promise.all([getSettings(), getTeam(), getReviews()]);

  const steps = [
    ["Choose your treatment", "Browse the services, see the price and how long each one takes, and add any extras."],
    ["Pick a stylist and time", "Book online at a time that suits you. You do not need an account."],
    [
      "Add what you need",
      "Put hair and care products in the same booking, so everything is arranged in one go.",
    ],
    ["Sit back and enjoy", "We email your confirmation and a reminder. All you have to do is relax."],
  ];

  return (
    <>
      <PhotoBanner
        image="/images/about-banner.jpg"
        position="object-[center_78%]"
        eyebrow="Our story"
        title={`About ${s.businessName}`}
      >
        <p>{s.heroSubtitle}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/book" className="btn btn-primary">
            Book a visit
          </Link>
          <Link href="/services" className="btn border-cream/50 text-cream hover:bg-white/10">
            See our services
          </Link>
        </div>
      </PhotoBanner>

      <section className="container-page grid items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16 lg:py-20">
        <Photo
          src="/images/about-story.jpg"
          alt="A smiling woman with long braids"
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="aspect-[4/5] rounded-t-[10rem] rounded-b-3xl"
        />
        <div>
          <p className="eyebrow">Who we are</p>
          <h2 className="font-display text-4xl sm:text-5xl">Hair that feels like you</h2>
          <p className="mt-6 text-lg leading-8 whitespace-pre-line">{s.aboutText}</p>
          <p className="mt-4 leading-7 text-muted">
            Whether you are after a long-lasting protective style, a sleek finish or the right
            products for home, our aim is simple: you leave looking good and feeling confident.
          </p>
          <Link href="/gallery" className="btn btn-outline mt-8">
            See our work
          </Link>
        </div>
      </section>

      <section className="border-y border-line bg-white py-16">
        <div className="container-page">
          <SectionTitle eyebrow="What we do" title="Everything for your hair" />
          <div className="grid gap-6 md:grid-cols-3">
            {OFFERS.map((offer) => (
              <article key={offer.title} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-pearl">
                <Photo src={offer.image} alt={offer.alt} className="aspect-[4/3]" sizes="(min-width: 768px) 33vw, 100vw" />
                <div className="flex flex-1 flex-col items-start p-5">
                  <h3 className="font-display text-2xl">{offer.title}</h3>
                  <p className="mt-1 mb-4 text-sm leading-6 text-muted">{offer.text}</p>
                  <Link href={offer.href} className="link mt-auto text-sm">
                    {offer.link}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <SectionTitle eyebrow="Your visit" title="How it works" />
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([title, text], i) => (
            <li key={title} className="card">
              <span className="grid size-10 place-items-center rounded-full bg-gold font-semibold text-black" aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="mt-4 font-display text-2xl">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
            </li>
          ))}
        </ol>
        {Boolean(s.mobileEnabled) && (
          <p className="mt-6 rounded-2xl bg-sand px-5 py-4 text-sm">
            <strong>Prefer to stay in?</strong> Selected services can be booked at your home. Choose
            the home visit option when you <Link href="/book" className="link">book online</Link>.
          </p>
        )}
      </section>

      {team.length > 0 && (
        <section id="team" className="container-page scroll-mt-24 pb-16">
          <SectionTitle eyebrow="Our people" title="Meet the team" />
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((person) => (
              <article key={person.id}>
                <Photo src={person.imagePath} alt={person.name} className="aspect-[3/4] rounded-t-[8rem] rounded-b-2xl" />
                <h3 className="mt-4 font-display text-3xl">{person.name}</h3>
                <p className="text-sm text-bronze">{person.title}</p>
                <p className="mt-2 text-sm leading-6 whitespace-pre-line text-muted">{person.bio}</p>
                {person.services.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {person.services.map((service) => (
                      <li key={service.id}>
                        <Link href={`/services/${service.slug}`} prefetch={false} className="chip text-xs">
                          {service.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {reviews.length > 0 && (
        <section className="border-t border-line py-16">
          <div className="container-page">
            <SectionTitle eyebrow="Kind words" title="From our customers" />
            <ReviewList reviews={reviews.slice(0, 3)} />
          </div>
        </section>
      )}

      <section className="on-dark bg-black py-20 text-center text-cream">
        <div className="container-page">
          <h2 className="font-display text-4xl text-cream sm:text-5xl">Your next look starts here</h2>
          <p className="mx-auto mt-3 max-w-md text-cream/75">
            Choose a treatment and a time, or ask us a question first.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/book" className="btn btn-primary">
              Book online
            </Link>
            <Link href="/contact" className="btn border-cream/50 text-cream hover:bg-white/10">
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
