import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/api", "/manage", "/pay", "/receipt", "/unsubscribe", "/checkout", "/cart"],
    },
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
