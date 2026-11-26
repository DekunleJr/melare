import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { label } from "@/lib/labels";

const tones: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-900",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-red-100 text-red-800",
  grey: "bg-stone-200 text-stone-700",
  blue: "bg-sky-100 text-sky-900",
};

const statusTone: Record<string, keyof typeof tones> = {
  paid: "green",
  confirmed: "green",
  completed: "green",
  active: "green",
  approved: "green",
  sent: "green",
  pending: "amber",
  requested: "amber",
  capturing: "blue",
  published: "green",
  declined: "red",
  pending_payment: "amber",
  unpaid: "amber",
  draft: "amber",
  new: "amber",
  queued: "amber",
  processing: "blue",
  ready_for_pickup: "blue",
  shipped: "blue",
  logged: "blue",
  admin: "blue",
  cancelled: "red",
  no_show: "red",
  failed: "red",
  rejected: "red",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[statusTone[status] ?? "grey"]}`}
    >
      {label(status)}
    </span>
  );
}

export function PageHero({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-line bg-cream">
      <div className="container-page py-14 text-center sm:py-20">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="font-display text-4xl sm:text-6xl">{title}</h1>
        {children && <div className="mx-auto mt-4 max-w-2xl text-muted">{children}</div>}
      </div>
    </header>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="font-display text-3xl sm:text-4xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="link text-sm">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
      <p className="font-display text-2xl">{title}</p>
      {children && <div className="mt-3 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span
      className="inline-flex text-amber-600"
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          aria-hidden="true"
          fill={i <= Math.round(rating) ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

/** Image box with a soft placeholder when nothing has been uploaded. */
export function Photo({
  src,
  alt,
  className = "aspect-[4/5]",
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
  preload,
  eager,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  preload?: boolean;
  eager?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-sand to-line ${className}`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          preload={preload}
          loading={eager ? "eager" : undefined}
          className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center font-display text-5xl text-muted/40">
          {alt.charAt(0)}
        </span>
      )}
    </div>
  );
}

export function Loading({ label: text = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="container-page py-20 text-center text-muted">
      <span className="mx-auto mb-3 block size-6 animate-spin rounded-full border-2 border-line border-t-bronze motion-reduce:animate-none" />
      {text}
    </div>
  );
}

export function DetailList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map(([term, value]) => (
        <div key={term} className="flex justify-between gap-6 py-3 text-sm">
          <dt className="text-muted">{term}</dt>
          <dd className="text-right whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
