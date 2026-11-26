// Pure booking rules: no database, no framework, fully unit tested.
import { addDaysToKey, dateKey, dayRange, zonedInstant } from "@/lib/time";

export type Interval = { start: Date; end: Date };

export type SlotInput = {
  dateKey: string;
  durationMinutes: number;
  bufferMinutes: number;
  /** Journey time each way for a mobile appointment */
  travelMinutes?: number;
  intervalMinutes: number;
  /** The staff member's shifts on this weekday */
  hours: { startMinute: number; endMinute: number }[];
  timeOff: Interval[];
  /** When the staff member is already occupied, including travel and clean-up */
  busy: Interval[];
  earliest: Date;
  latest: Date;
};

export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);

/** The whole period an appointment keeps the staff member busy. */
export function occupiedBy(
  start: Date,
  durationMinutes: number,
  bufferMinutes: number,
  travelMinutes = 0,
) {
  const end = addMinutes(start, durationMinutes);
  return {
    start,
    end,
    blockedFrom: addMinutes(start, -travelMinutes),
    blockedUntil: addMinutes(end, bufferMinutes + travelMinutes),
  };
}

/** Start times at which the whole appointment fits. */
export function computeSlots(input: SlotInput): Date[] {
  const step = Math.max(5, input.intervalMinutes);
  const travel = input.travelMinutes ?? 0;
  const found = new Map<number, Date>();

  for (const shift of input.hours) {
    for (
      let minute = shift.startMinute;
      minute + input.durationMinutes <= shift.endMinute;
      minute += step
    ) {
      const start = zonedInstant(input.dateKey, minute);
      if (!start || start < input.earliest || start >= input.latest) continue;
      const slot = occupiedBy(start, input.durationMinutes, input.bufferMinutes, travel);
      const away = { start: slot.blockedFrom, end: addMinutes(slot.end, travel) };
      if (input.timeOff.some((off) => overlaps(away, off))) continue;
      const blocked = { start: slot.blockedFrom, end: slot.blockedUntil };
      if (input.busy.some((b) => overlaps(blocked, b))) continue;
      found.set(start.getTime(), start);
    }
  }
  return [...found.values()].sort((a, b) => a.getTime() - b.getTime());
}

/** The earliest and latest start times customers may book online. */
export function bookingWindow(
  now: Date,
  rules: { bookingLeadHours: number; bookingHorizonDays: number },
): { earliest: Date; latest: Date; firstDay: string; lastDay: string } {
  const earliest = addMinutes(now, rules.bookingLeadHours * 60);
  const lastDay = addDaysToKey(dateKey(now), rules.bookingHorizonDays);
  return { earliest, latest: dayRange(lastDay).end, firstDay: dateKey(earliest), lastDay };
}

/** Whether a customer may still cancel or reschedule online. */
export function canCustomerModify(
  booking: { status: string; startsAt: Date },
  noticeHours: number,
  now = new Date(),
): boolean {
  // Nothing is confirmed yet, so it can be withdrawn at any time.
  if (booking.status === "pending_payment" || booking.status === "requested") {
    return booking.startsAt > now;
  }
  if (booking.status !== "confirmed") return false;
  return booking.startsAt.getTime() - now.getTime() >= noticeHours * 3_600_000;
}
