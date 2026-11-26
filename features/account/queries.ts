import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { withOrderItems } from "@/db/relations";
import { bookings, orders, profiles } from "@/db/schema";
import { getOptionalUser, requireUser } from "@/lib/session";

/** Prefill for booking and checkout forms. Blank for guests. */
export async function getContactDefaults() {
  const user = await getOptionalUser();
  const [profile] = user
    ? await db.select().from(profiles).where(eq(profiles.userId, user.id))
    : [];
  return {
    signedIn: Boolean(user),
    customerName: user?.name ?? "",
    customerEmail: user?.email ?? "",
    customerPhone: profile?.phone ?? "",
    addressLine1: profile?.addressLine1 ?? "",
    addressLine2: profile?.addressLine2 ?? "",
    city: profile?.city ?? "",
    postcode: profile?.postcode ?? "",
  };
}

export async function getMyOrders() {
  const user = await requireUser("/account/orders");
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt));
  return withOrderItems(rows);
}

export async function getMyBookings() {
  const user = await requireUser("/account/bookings");
  return db
    .select()
    .from(bookings)
    .where(eq(bookings.userId, user.id))
    .orderBy(desc(bookings.startsAt));
}
