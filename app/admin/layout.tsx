import { Globe } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/site/auth-forms";
import { Logo } from "@/components/site/logo";
import { NavLink } from "@/components/ui/nav-link";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false },
};

const links = [
  ["", "Dashboard"],
  ["/bookings", "Bookings"],
  ["/orders", "Orders"],
  ["/payments", "Payments"],
  ["/reports", "Reports"],
  ["/products", "Products"],
  ["/categories", "Categories"],
  ["/discounts", "Discount codes"],
  ["/delivery", "Delivery"],
  ["/services", "Services"],
  ["/staff", "Staff"],
  ["/areas", "Mobile areas"],
  ["/customers", "Customers"],
  ["/reviews", "Reviews"],
  ["/gallery", "Gallery"],
  ["/blog", "Blog"],
  ["/pages", "Information pages"],
  ["/faqs", "FAQs"],
  ["/messages", "Messages"],
  ["/subscribers", "Subscribers"],
  ["/emails", "Email log"],
  ["/data", "Backups and exports"],
  ["/settings", "Settings"],
];

// Every admin page, query and action calls requireAdmin itself; this is only the frame.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="border-b on-dark border-line bg-black text-cream lg:w-56 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto lg:py-4">
          <div className="px-4 py-3">
            <Link href="/admin" prefetch={false} className="flex items-center gap-3 font-display text-2xl">
              <Logo name="MelareBeauty" className="h-14" />
              Admin
            </Link>
          </div>
          <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col">
            {links.map(([path, text]) => (
              <NavLink
                key={path}
                href={`/admin${path}`}
                // The dashboard is the root of every admin address.
                exact={!path}
                prefetch={false}
                className="rounded-lg px-3 py-2 text-sm whitespace-nowrap text-cream/80 hover:bg-white/10 hover:text-white"
              >
                {text}
              </NavLink>
            ))}
          </nav>
          <div className="hidden px-4 lg:block">
            <SignOutButton className="btn btn-sm border-white/30 text-cream hover:bg-white/10" />
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-8">
        <div className="mb-4 flex justify-end">
          <Link href="/" prefetch={false} className="btn btn-primary btn-sm shadow-sm">
            <Globe size={15} aria-hidden="true" />
            View site
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}
