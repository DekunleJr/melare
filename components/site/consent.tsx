"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

/*
 * Optional cookies (Google Analytics and Maps) load only after the visitor accepts.
 * The choice itself is kept in a first-party cookie.
 */
const COOKIE = "melare_consent";
export type Choice = "all" | "essential" | "unset";
const listeners = new Set<() => void>();

function read(): Choice {
  const value = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=(all|essential)`))?.[1];
  return (value as Choice | undefined) ?? "unset";
}

function write(choice: Choice) {
  const age = choice === "unset" ? 0 : 60 * 60 * 24 * 180;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${choice}; Path=/; Max-Age=${age}; SameSite=Lax${secure}`;
  if (choice !== "all") {
    // Remove analytics cookies when consent is withdrawn.
    for (const part of document.cookie.split("; ")) {
      const name = part.split("=")[0];
      if (name.startsWith("_ga")) {
        for (const domain of ["", `; Domain=.${location.hostname.replace(/^www\./, "")}`]) {
          document.cookie = `${name}=; Path=/; Max-Age=0${domain}`;
        }
      }
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** null while rendering on the server */
export function useConsent(): Choice | null {
  return useSyncExternalStore<Choice | null>(subscribe, read, () => null);
}

export function CookieBanner() {
  const choice = useConsent();
  if (choice !== "unset") return null;
  return (
    <div role="region" aria-label="Cookie choice" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white p-4 shadow-2xl">
      <div className="container-page flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          We use essential cookies to run the site. With your permission we also use Google cookies
          for visitor statistics and maps.{" "}
          <Link href="/privacy" prefetch={false} className="link">
            Privacy notice
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => write("essential")}>
            Essential only
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => write("all")}>
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}

export function CookieSettingsButton() {
  return (
    <button type="button" className="cursor-pointer underline" onClick={() => write("unset")}>
      Cookie settings
    </button>
  );
}

/** Pages whose address is private, or that are only for staff, are never measured. */
const PRIVATE = /^\/(admin|account|manage|pay|receipt|reset-password|unsubscribe|cart\/restore)(\/|$)/;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean;
  }
}

export function Analytics({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const choice = useConsent();
  const allowed = choice === "all" && !PRIVATE.test(pathname) && /^G-[A-Z0-9]+$/.test(measurementId);

  useEffect(() => {
    if (!measurementId) return;
    window[`ga-disable-${measurementId}`] = !allowed;
    if (!allowed) return;
    if (!window.gtag) {
      window.dataLayer = [];
      // Google's snippet must push the arguments object itself.
      window.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer!.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", measurementId, { send_page_view: false });
      const tag = document.createElement("script");
      tag.async = true;
      tag.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(tag);
    }
    window.gtag("event", "page_view", {
      page_location: location.origin + pathname,
      page_path: pathname,
    });
  }, [allowed, pathname, measurementId]);

  return null;
}

export function MapEmbed({ address, title }: { address: string; title: string }) {
  const choice = useConsent();
  const [once, setOnce] = useState(false);
  const query = encodeURIComponent(address);
  if (choice === "all" || once) {
    return (
      <iframe
        title={title}
        src={`https://www.google.com/maps?q=${query}&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="aspect-[4/3] w-full rounded-2xl border border-line"
      />
    );
  }
  return (
    <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl border border-line bg-sand p-6 text-center text-sm">
      <div>
        <p className="mb-3">Showing the map loads content and cookies from Google.</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOnce(true)}>
          Show map
        </button>
        <p className="mt-3">
          <a href={`https://www.google.com/maps?q=${query}`} className="link" target="_blank" rel="noopener noreferrer">
            Open in Google Maps
          </a>
        </p>
      </div>
    </div>
  );
}
