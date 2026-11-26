"use client";

import { Menu, User, X } from "lucide-react";
import { useState } from "react";
import { NavLink } from "@/components/ui/nav-link";

/** Signed-out visitors are redirected to sign in, so no session read is needed here. */
export function AccountLink() {
  return (
    <NavLink href="/account" prefetch={false} className="block rounded-full p-2" aria-label="My account">
      <User size={20} />
    </NavLink>
  );
}

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="p-2"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      {open && (
        <nav
          aria-label="Mobile"
          className="absolute inset-x-0 top-20 border-b border-white/10 bg-black text-cream shadow-lg"
        >
          {links.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block border-t border-white/10 px-6 py-3.5 hover:text-gold"
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
