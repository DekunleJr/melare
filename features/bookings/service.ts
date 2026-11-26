import "server-only";
import { and, asc, eq, gt, inArray, lt, ne, or } from "drizzle-orm";
import { db, type Db, type Tx } from "@/db";
import { bookings, staff, staffServices, timeOff, workingHours } from "@/db/schema";
import { UserError, withRetry } from "@/lib/errors";
import { readSettings } from "@/lib/settings";
import { dateKey, dayRange, weekdayOfKey } from "@/lib/time";
import {
  bookingWindow,
  canCustomerModify,
  computeSlots,
  occupiedBy,
  overlaps,
} from "./availability";

export type Booking = typeof bookings.$inferSelect;
type Conn = Db | Tx;

export const TAKEN = "Sorry, that time has just been taken. Please choose another.";

/** Bookings that occupy a staff member's diary right now. */
export const occupying = (now: Date) =>
  or(
    inArray(bookings.status, ["confirmed", "completed", "no_show"]),
    // Requests and unpaid bookings hold the slot until their deadline.
    and(
      inArray(bookings.status, ["requested", "pending_payment"]),
      gt(bookings.holdExpiresAt, now),
    ),
  );

export async function loadDay(
  conn: Conn,
  staffId: number,
  key: string,
  now: Date,
  excludeBookingId?: number,
) {
  const { start, end } = dayRange(key);
  const hours = await conn
    .select()
    .from(workingHours)
    .where(and(eq(workingHours.staffId, staffId), eq(workingHours.weekday, weekdayOfKey(key))));
  const off = await conn
    .select()
    .from(timeOff)
    .where(and(eq(timeOff.staffId, staffId), lt(timeOff.startsAt, end), gt(timeOff.endsAt, start)));
  const day = 86_400_000;
  const taken = await conn
    .select({ from: bookings.blockedFrom, until: bookings.blockedUntil })
    .from(bookings)
    .where(
      and(
        eq(bookings.staffId, staffId),
        // A day either side catches appointments and journeys that cross midnight.
        lt(bookings.blockedFrom, new Date(end.getTime() + day)),
        gt(bookings.blockedUntil, new Date(start.getTime() - day)),
        occupying(now),
        excludeBookingId ? ne(bookings.id, excludeBookingId) : undefined,
      ),
    );
  return {
    hours,
    timeOff: off.map((o) => ({ start: o.startsAt, end: o.endsAt })),
    busy: taken.map((b) => ({ start: b.from, end: b.until })),
  };
}

export async function staffForService(serviceId: number, mobile = false) {
  return db
    .select({ id: staff.id, name: staff.name, title: staff.title, imagePath: staff.imagePath })
    .from(staffServices)
    .innerJoin(staff, eq(staff.id, staffServices.staffId))
    .where(
      and(
        eq(staffServices.serviceId, serviceId),
        eq(staff.active, true),
        mobile ? eq(staff.offersMobile, true) : undefined,
      ),
    )
    .orderBy(asc(staff.sortOrder), asc(staff.name));
}

export type Slot = { start: Date; staffIds: number[] };

/** Online availability for one service on one salon-local day. */
export async function getAvailability(options: {
  serviceId: number;
  dateKey: string;
  staffId?: number | null;
  durationMinutes: number;
  bufferMinutes: number;
  travelMinutes?: number;
  mobile?: boolean;
  excludeBookingId?: number;
  now?: Date;
}): Promise<Slot[]> {
  const now = options.now ?? new Date();
  const rules = await readSettings();
  const window = bookingWindow(now, rules);
  const people = (await staffForService(options.serviceId, options.mobile)).filter(
    (p) => !options.staffId || p.id === options.staffId,
  );
  const slots = new Map<number, Slot>();
  for (const person of people) {
    const day = await loadDay(db, person.id, options.dateKey, now, options.excludeBookingId);
    for (const start of computeSlots({
      dateKey: options.dateKey,
      durationMinutes: options.durationMinutes,
      bufferMinutes: options.bufferMinutes,
      travelMinutes: options.travelMinutes,
      intervalMinutes: rules.slotIntervalMinutes,
      ...day,
      earliest: window.earliest,
      latest: window.latest,
    })) {
      const slot = slots.get(start.getTime()) ?? { start, staffIds: [] };
      slot.staffIds.push(person.id);
      slots.set(start.getTime(), slot);
    }
  }
  return [...slots.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Lock the staff member first so simultaneous bookings are handled one at a time. */
export async function lockStaff(tx: Tx, staffId: number) {
  await tx.select({ id: staff.id }).from(staff).where(eq(staff.id, staffId)).for("update");
}

/**
 * Must be the first thing done in a transaction: locks the diary and says whether
 * the time is free. Admin bookings ignore shifts and notice periods, never clashes.
 */
export async function claimSlot(
  tx: Tx,
  request: {
    staffId: number;
    start: Date;
    durationMinutes: number;
    bufferMinutes: number;
    travelMinutes: number;
    source: "online" | "admin";
    excludeBookingId?: number;
  },
  rules: Awaited<ReturnType<typeof readSettings>>,
  now: Date,
): Promise<boolean> {
  await lockStaff(tx, request.staffId);
  const key = dateKey(request.start);
  const day = await loadDay(tx, request.staffId, key, now, request.excludeBookingId);
  if (request.source === "admin") {
    const slot = occupiedBy(
      request.start,
      request.durationMinutes,
      request.bufferMinutes,
      request.travelMinutes,
    );
    return !day.busy.some((b) =>
      overlaps({ start: slot.blockedFrom, end: slot.blockedUntil }, b),
    );
  }
  const window = bookingWindow(now, rules);
  return computeSlots({
    dateKey: key,
    durationMinutes: request.durationMinutes,
    bufferMinutes: request.bufferMinutes,
    travelMinutes: request.travelMinutes,
    intervalMinutes: rules.slotIntervalMinutes,
    ...day,
    earliest: window.earliest,
    latest: window.latest,
  }).some((slot) => slot.getTime() === request.start.getTime());
}

export async function getBooking(id: number): Promise<Booking | undefined> {
  const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
  return row;
}

export async function lockBooking(tx: Tx, id: number): Promise<Booking | undefined> {
  const [row] = await tx.select().from(bookings).where(eq(bookings.id, id)).for("update");
  return row;
}

/** Duration, buffer and journey of an existing booking, taken from its own times. */
export function bookingShape(b: Booking) {
  const minutes = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 60_000;
  return {
    durationMinutes: minutes(b.startsAt, b.endsAt),
    travelMinutes: b.travelMinutes,
    bufferMinutes: minutes(b.endsAt, b.blockedUntil) - b.travelMinutes,
  };
}

export async function rescheduleBooking(
  id: number,
  start: Date,
  by: "customer" | "admin",
  now = new Date(),
): Promise<Booking> {
  const existing = await getBooking(id);
  if (!existing) throw new UserError("Booking not found.");
  const rules = await readSettings();
  const shape = bookingShape(existing);
  const times = occupiedBy(start, shape.durationMinutes, shape.bufferMinutes, shape.travelMinutes);

  return withRetry(() =>
    db.transaction(async (tx) => {
      const free = await claimSlot(
        tx,
        { staffId: existing.staffId, start, ...shape, source: by === "admin" ? "admin" : "online", excludeBookingId: id },
        rules,
        now,
      );
      const booking = await lockBooking(tx, id);
      if (!booking || booking.status !== "confirmed") {
        throw new UserError("Only confirmed bookings can be rescheduled.");
      }
      if (by === "customer" && !canCustomerModify(booking, rules.cancellationNoticeHours, now)) {
        throw new UserError("It is too close to your appointment to change it online.");
      }
      if (!free) throw new UserError(TAKEN);
      const changes = {
        startsAt: times.start,
        endsAt: times.end,
        blockedFrom: times.blockedFrom,
        blockedUntil: times.blockedUntil,
        reminderSentAt: null,
      };
      await tx.update(bookings).set(changes).where(eq(bookings.id, id));
      return { ...booking, ...changes };
    }),
  );
}
