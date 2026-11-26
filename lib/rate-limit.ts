import "server-only";
import { headers } from "next/headers";

/*
 * Fixed-window limiter held in memory. Suitable for a single Node server;
 * move to the database or Redis if the site is ever run on several instances.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function hit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/** True when the visitor is still within `limit` calls per `minutes` for this action. */
export async function allowRequest(action: string, limit: number, minutes: number) {
  const h = await headers();
  // The reverse proxy in front of the app must set these headers.
  const ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
  return hit(`${action}:${ip}`, limit, minutes * 60_000);
}
