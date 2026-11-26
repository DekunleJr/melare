import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/site/auth-forms";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

const links = [
  ["/account", "Overview"],
  ["/account/orders", "Orders"],
  ["/account/bookings", "Bookings"],
  ["/account/payments", "Payments"],
  ["/account/profile", "Profile"],
];

// Each page checks the session itself; this layout is only navigation.
export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="container-page max-w-4xl py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Account" className="flex flex-wrap gap-2">
          {links.map(([href, text]) => (
            <Link key={href} href={href} prefetch={false} className="chip">
              {text}
            </Link>
          ))}
        </nav>
        <SignOutButton />
      </div>
      {children}
    </div>
  );
}
