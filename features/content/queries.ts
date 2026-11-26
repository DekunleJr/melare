import "server-only";
import { and, asc, avg, count, desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import {
  withProductDetails,
  withServiceExtras,
  withServiceStaff,
  withStaffDetails,
} from "@/db/relations";
import {
  categories,
  contentPages,
  faqs,
  galleryImages,
  mobileAreas,
  posts,
  products,
  reviews,
  services,
  staff,
} from "@/db/schema";
import { variantLabel, variantPrice } from "@/features/pricing";
import { defaultPages, fillPlaceholders, type PageSlug } from "@/lib/default-pages";
import { readSettings } from "@/lib/settings";
import { TAGS } from "@/lib/tags";

// Public, shared content. Admin actions refresh the tags, so edits show at once.

export async function getSettings() {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife("hours");
  // The private notification address never reaches public pages.
  return { ...(await readSettings()), contactEmail: "", calendarNonce: "" };
}

async function ratings(column: typeof reviews.productId | typeof reviews.serviceId) {
  const rows = await db
    .select({ id: column, average: avg(reviews.rating), total: count() })
    .from(reviews)
    .where(eq(reviews.status, "approved"))
    .groupBy(column);
  return new Map(rows.map((r) => [r.id, { average: Number(r.average), total: r.total }]));
}

export async function getShopProducts() {
  "use cache";
  cacheTag(TAGS.products, TAGS.reviews);
  cacheLife("hours");
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.status, "active"))
    .orderBy(desc(products.featured), desc(products.createdAt));
  const scores = await ratings(reviews.productId);
  return (await withProductDetails(rows)).map(({ variants, ...p }) => {
    const options = variants
      .filter((v) => v.active)
      .map((v) => ({ ...v, label: variantLabel(v), nowPence: variantPrice(v) }));
    // The cheapest option that can be bought sets the "from" price.
    const available = options.filter((v) => v.stock > 0);
    const cheapest = [...(available.length ? available : options)].sort(
      (a, b) => a.nowPence - b.nowPence,
    )[0];
    return {
      ...p,
      variants: options,
      pricePence: cheapest?.nowPence ?? 0,
      wasPence: cheapest && cheapest.nowPence < cheapest.pricePence ? cheapest.pricePence : 0,
      variesInPrice: new Set(options.map((v) => v.nowPence)).size > 1,
      stock: options.reduce((n, v) => n + v.stock, 0),
      rating: scores.get(p.id) ?? null,
    };
  });
}

export type ShopProduct = Awaited<ReturnType<typeof getShopProducts>>[number];

export async function getCategories() {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("hours");
  return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getPublicServices() {
  "use cache";
  cacheTag(TAGS.services, TAGS.staff, TAGS.reviews);
  cacheLife("hours");
  const rows = await db
    .select()
    .from(services)
    .where(eq(services.status, "active"))
    .orderBy(asc(services.sortOrder), asc(services.category), asc(services.name));
  const scores = await ratings(reviews.serviceId);
  return (await withServiceExtras(await withServiceStaff(rows))).map((s) => ({
    ...s,
    staff: s.staff.filter((p) => p.active),
    addons: s.addons.filter((a) => a.active),
    rating: scores.get(s.id) ?? null,
  }));
}

export async function getMobileDistricts() {
  "use cache";
  cacheTag(TAGS.areas);
  cacheLife("hours");
  return db
    .select()
    .from(mobileAreas)
    .where(eq(mobileAreas.active, true))
    .orderBy(asc(mobileAreas.district));
}

/** A policy or information page, using the owner's text if they have edited it. */
export async function getPage(slug: PageSlug) {
  "use cache";
  cacheTag(TAGS.pages, TAGS.settings);
  cacheLife("hours");
  const [saved] = await db.select().from(contentPages).where(eq(contentPages.slug, slug));
  const page = saved ?? defaultPages[slug];
  const s = await getSettings();
  return { title: page.title, body: fillPlaceholders(page.body, s) };
}

export async function getPosts() {
  "use cache";
  cacheTag(TAGS.posts);
  cacheLife("hours");
  return db
    .select()
    .from(posts)
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.publishedAt))
    .limit(200);
}

export type PublicService = Awaited<ReturnType<typeof getPublicServices>>[number];

export async function getTeam() {
  "use cache";
  cacheTag(TAGS.staff, TAGS.services);
  cacheLife("hours");
  const rows = await db
    .select()
    .from(staff)
    .where(eq(staff.active, true))
    .orderBy(asc(staff.sortOrder), asc(staff.name));
  return (await withStaffDetails(rows)).map((person) => ({
    ...person,
    services: person.services.filter((s) => s.status === "active"),
  }));
}

export async function getGallery() {
  "use cache";
  cacheTag(TAGS.gallery);
  cacheLife("hours");
  return db
    .select()
    .from(galleryImages)
    .orderBy(asc(galleryImages.sortOrder), desc(galleryImages.id));
}

export async function getReviews(target?: { productId?: number; serviceId?: number }) {
  "use cache";
  cacheTag(TAGS.reviews);
  cacheLife("hours");
  return db
    .select({
      id: reviews.id,
      authorName: reviews.authorName,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.status, "approved"),
        target?.productId ? eq(reviews.productId, target.productId) : undefined,
        target?.serviceId ? eq(reviews.serviceId, target.serviceId) : undefined,
      ),
    )
    .orderBy(desc(reviews.createdAt))
    .limit(30);
}

export async function getFaqs() {
  "use cache";
  cacheTag(TAGS.faqs);
  cacheLife("hours");
  return db
    .select()
    .from(faqs)
    .where(eq(faqs.published, true))
    .orderBy(asc(faqs.sortOrder), asc(faqs.id));
}

/** Used by the sitemap. */
export async function getSlugs() {
  "use cache";
  cacheTag(TAGS.products, TAGS.services, TAGS.posts);
  cacheLife("hours");
  return {
    posts: await db.select({ slug: posts.slug }).from(posts).where(eq(posts.status, "published")),
    products: await db
      .select({ slug: products.slug })
      .from(products)
      .where(eq(products.status, "active")),
    services: await db
      .select({ slug: services.slug })
      .from(services)
      .where(eq(services.status, "active")),
  };
}
