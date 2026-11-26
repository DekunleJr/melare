import type { MetadataRoute } from "next";
import { getSlugs } from "@/features/content/queries";
import { env } from "@/lib/env";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products, services, posts } = await getSlugs();
  const paths = [
    "",
    "/services",
    "/shop",
    "/book",
    "/team",
    "/gallery",
    "/about",
    "/contact",
    "/faq",
    "/privacy",
    "/terms",
    "/delivery",
    "/returns",
    "/cancellation-policy",
    "/blog",
    ...posts.map((p) => `/blog/${p.slug}`),
    ...services.map((s) => `/services/${s.slug}`),
    ...products.map((p) => `/shop/${p.slug}`),
  ];
  return paths.map((path) => ({ url: `${env.siteUrl}${path}` }));
}
