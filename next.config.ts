import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // "payment" is needed by the Apple Pay and Google Pay buttons.
    value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://www.paypal.com" "https://pay.google.com")',
  },
];

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    serverActions: {
      // Image uploads (5 MB limit per image, enforced in lib/storage.ts).
      bodySizeLimit: "6mb",
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  images: {
    // Uploads are served by app/uploads/[name]/route.ts; fixed page photos live in public/images.
    localPatterns: [
      { pathname: "/uploads/**", search: "" },
      { pathname: "/images/**", search: "" },
    ],
  },
  async redirects() {
    // The team is now introduced on the About page; keep old links working.
    return [{ source: "/team", destination: "/about#team", permanent: false }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Private links must never leak through the Referer header.
      {
        source: "/manage/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      { source: "/pay/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/receipt/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      {
        source: "/reset-password",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
