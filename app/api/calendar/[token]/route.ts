import { and, asc, eq, gt, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { bookings, user } from "@/db/schema";
import { buildCalendar } from "@/lib/email/templates";
import { readSettings } from "@/lib/settings";
import { parseFeedToken, verifyFeedToken } from "@/lib/tokens";

/*
 * A calendar that Google, Apple or Outlook can subscribe to. It updates itself,
 * one way, from this site. The long signed link is the only credential.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/calendar/[token]">) {
  const token = decodeURIComponent((await ctx.params).token).replace(/\.ics$/, "");
  const feed = parseFeedToken(token);
  const settings = await readSettings();
  const nonce = feed?.scope === "user" ? "" : settings.calendarNonce;
  if (!feed || !verifyFeedToken(token, nonce)) {
    return new Response("Not found", { status: 404 });
  }

  let who: SQL | undefined;
  if (feed.scope === "staff") who = eq(bookings.staffId, Number(feed.id));
  if (feed.scope === "user") {
    const [account] = await db.select().from(user).where(eq(user.id, feed.id));
    if (!account || account.disabled) return new Response("Not found", { status: 404 });
    who = eq(bookings.userId, feed.id);
  }
  const own = feed.scope === "user";
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        who,
        inArray(bookings.status, own ? ["confirmed", "completed"] : ["requested", "pending_payment", "confirmed", "completed"]),
        gt(bookings.startsAt, new Date(Date.now() - 60 * 86_400_000)),
      ),
    )
    .orderBy(asc(bookings.startsAt))
    .limit(2000);

  const address = (b: (typeof rows)[number]) =>
    [b.addressLine1, b.addressLine2, b.city, b.postcode].filter(Boolean).join(", ");
  const calendar = buildCalendar(
    own ? settings.businessName : `${settings.businessName} bookings`,
    rows.map((b) => ({
      uid: `${b.reference}@melarebeauty`,
      start: b.startsAt,
      end: b.endsAt,
      summary: own
        ? `${b.serviceName} at ${settings.businessName}`
        : `${b.status === "confirmed" || b.status === "completed" ? "" : "(Unconfirmed) "}${b.serviceName}: ${b.customerName} (${b.staffName})`,
      description: own ? undefined : `${b.customerPhone}\n${b.reference}`,
      location: b.locationType === "mobile" ? address(b) : settings.address || undefined,
    })),
  );
  return new Response(calendar, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
