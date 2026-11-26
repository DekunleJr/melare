import "server-only";
import { asc, eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import { subscribers } from "@/db/schema";
import { env } from "@/lib/env";
import { isDuplicateEntry } from "@/lib/errors";
import { newNonce } from "@/lib/tokens";

/*
 * Subscribers are stored here and, when a Resend segment is configured, copied
 * there so campaigns can be written and sent from Resend Broadcasts.
 */
export const isMarketingSyncConfigured = () => Boolean(env.resendApiKey && env.resendSegmentId);

async function syncContact(email: string, unsubscribed: boolean): Promise<boolean> {
  if (!isMarketingSyncConfigured()) return false;
  try {
    const resend = new Resend(env.resendApiKey);
    if (!unsubscribed) {
      const created = await resend.contacts.create({
        email,
        unsubscribed: false,
        segments: [{ id: env.resendSegmentId }],
      });
      if (!created.error) return true;
    }
    // Already exists, or is leaving.
    const updated = await resend.contacts.update({ email, unsubscribed });
    if (updated.error) {
      console.error(`Resend contact sync failed: ${updated.error.message}`);
      return false;
    }
    if (!unsubscribed) await resend.contacts.segments.add({ email, segmentId: env.resendSegmentId });
    return true;
  } catch (error) {
    console.error("Resend contact sync failed", error);
    return false;
  }
}

export async function addSubscriber(email: string) {
  try {
    await db.insert(subscribers).values({ email, tokenNonce: newNonce() });
  } catch (error) {
    if (!isDuplicateEntry(error)) throw error;
  }
  await syncContact(email, false);
}

export async function removeSubscriberByEmail(email: string) {
  await db.delete(subscribers).where(eq(subscribers.email, email));
  await syncContact(email, true);
}

export async function syncAllSubscribers() {
  const rows = await db.select().from(subscribers).orderBy(asc(subscribers.id)).limit(2000);
  let synced = 0;
  for (const row of rows) {
    if (await syncContact(row.email, false)) synced++;
    // Stay under Resend's request rate.
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return { synced, total: rows.length };
}
