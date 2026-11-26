"use client";

import { Menu, User, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/** Signed-out visitors are redirected to sign in, so no session read is needed here. */
export function AccountLink() {
  return (
    <Link href="/account" prefetch={false} className="p-2" aria-label="My account">
      <User size={20} />
    </Link>
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
          className="absolute inset-x-0 top-16 border-b border-line bg-cream shadow-lg"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block border-t border-line/60 px-6 py-3.5"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
