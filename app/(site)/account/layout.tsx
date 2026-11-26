import type { Metadata } from "next";
import { SignOutButton } from "@/components/site/auth-forms";
import { NavLink } from "@/components/ui/nav-link";

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
            <NavLink
              key={href}
              href={href}
              exact={href === "/account"}
              prefetch={false}
              className="chip"
              activeClassName="aria-[current=page]:border-neutral-400 aria-[current=page]:bg-neutral-300"
            >
              {text}
            </NavLink>
          ))}
        </nav>
        <SignOutButton />
      </div>
      {children}
    </div>
  );
}
