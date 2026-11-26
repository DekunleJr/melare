import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  bookingAddons,
  bookings,
  contactMessages,
  orderItems,
  orders,
  payments,
  profiles,
  reviews,
  subscribers,
  user,
} from "@/db/schema";
import { requireUser } from "@/lib/session";

/** Everything held about the signed-in person, as a file. */
export async function GET() {
  const me = await requireUser("/account/profile");
  const [account] = await db.select().from(user).where(eq(user.id, me.id));
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, me.id));
  // Only records made while signed in: an unverified email is not proof of identity.
  const myOrders = await db.select().from(orders).where(eq(orders.userId, me.id));
  const myBookings = await db.select().from(bookings).where(eq(bookings.userId, me.id));
  const none = [0];
  const items = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, myOrders.length ? myOrders.map((o) => o.id) : none));
  const addons = await db
    .select()
    .from(bookingAddons)
    .where(inArray(bookingAddons.bookingId, myBookings.length ? myBookings.map((b) => b.id) : none));
  const paid = await db.select().from(payments).where(eq(payments.userId, me.id));
  const written = await db.select().from(reviews).where(eq(reviews.userId, me.id));
  const subscribed = account.emailVerified
    ? await db.select().from(subscribers).where(eq(subscribers.email, me.email))
    : [];
  const messages = account.emailVerified
    ? await db.select().from(contactMessages).where(eq(contactMessages.email, me.email))
    : [];

  // Secrets used to sign private links are not personal data.
  const clean = <T extends object>(rows: T[]) =>
    rows.map((row) =>
      Object.fromEntries(Object.entries(row).filter(([key]) => key !== "tokenNonce")),
    );
  const data = {
    exportedAt: new Date().toISOString(),
    account: {
      name: account.name,
      email: account.email,
      created: account.createdAt,
    },
    profile: profile ?? null,
    orders: clean(myOrders),
    orderItems: items,
    bookings: clean(myBookings),
    bookingExtras: addons,
    payments: clean(paid),
    reviews: written,
    newsletter: clean(subscribed),
    messages,
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="my-data.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
