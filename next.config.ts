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
    // Every site image is an upload served by app/uploads/[name]/route.ts.
    localPatterns: [{ pathname: "/uploads/**", search: "" }],
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
