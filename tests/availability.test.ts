import { describe, expect, it } from "vitest";
import {
  bookingWindow,
  canCustomerModify,
  computeSlots,
  type SlotInput,
} from "@/features/bookings/availability";
import { zonedInstant } from "@/lib/time";

const base: SlotInput = {
  dateKey: "2027-01-12",
  durationMinutes: 60,
  bufferMinutes: 0,
  intervalMinutes: 60,
  hours: [{ startMinute: 9 * 60, endMinute: 12 * 60 }],
  timeOff: [],
  busy: [],
  earliest: new Date("2027-01-01T00:00:00Z"),
  latest: new Date("2027-12-31T00:00:00Z"),
};
const iso = (dates: Date[]) => dates.map((d) => d.toISOString().slice(11, 16));
const at = (time: string) => new Date(`2027-01-12T${time}:00Z`);

describe("computeSlots", () => {
  it("offers every start where the whole service fits in the shift", () => {
    expect(iso(computeSlots(base))).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("removes slots that overlap an existing booking", () => {
    const busy = [{ start: at("10:00"), end: at("11:00") }];
    expect(iso(computeSlots({ ...base, busy }))).toEqual(["09:00", "11:00"]);
  });

  it("keeps the clean-up buffer clear of the next booking", () => {
    const busy = [{ start: at("10:00"), end: at("11:00") }];
    expect(iso(computeSlots({ ...base, bufferMinutes: 15, busy }))).toEqual(["11:00"]);
  });

  it("leaves travel time either side of a mobile appointment", () => {
    // Busy 10:00-11:00: with 30 minutes of travel nothing adjacent to it fits.
    const busy = [{ start: at("10:00"), end: at("11:00") }];
    const hours = [{ startMinute: 9 * 60, endMinute: 14 * 60 }];
    const slots = computeSlots({
      ...base,
      hours,
      busy,
      intervalMinutes: 30,
      travelMinutes: 30,
    });
    expect(iso(slots)).toEqual(["11:30", "12:00", "12:30", "13:00"]);
  });

  it("does not let travel run into time off", () => {
    const timeOff = [{ start: at("12:00"), end: at("13:00") }];
    expect(iso(computeSlots({ ...base, timeOff, travelMinutes: 30 }))).toEqual(["09:00", "10:00"]);
  });

  it("respects time off", () => {
    const timeOff = [{ start: at("09:30"), end: at("10:30") }];
    expect(iso(computeSlots({ ...base, timeOff }))).toEqual(["11:00"]);
  });

  it("leaves a gap for a lunch break (two shifts)", () => {
    const hours = [
      { startMinute: 9 * 60, endMinute: 10 * 60 },
      { startMinute: 13 * 60, endMinute: 14 * 60 },
    ];
    expect(iso(computeSlots({ ...base, hours }))).toEqual(["09:00", "13:00"]);
  });

  it("applies the notice period and booking horizon", () => {
    const result = computeSlots({ ...base, earliest: at("09:30"), latest: at("11:00") });
    expect(iso(result)).toEqual(["10:00"]);
  });

  it("converts British Summer Time to UTC", () => {
    expect(iso(computeSlots({ ...base, dateKey: "2027-07-13" }))).toEqual([
      "08:00",
      "09:00",
      "10:00",
    ]);
  });

  it("never offers a wall-clock time skipped when the clocks go forward", () => {
    // 28 March 2027: 01:00 to 02:00 does not exist in London.
    expect(zonedInstant("2027-03-28", 90)).toBeNull();
    const result = computeSlots({
      ...base,
      dateKey: "2027-03-28",
      durationMinutes: 30,
      intervalMinutes: 30,
      hours: [{ startMinute: 0, endMinute: 180 }],
    });
    expect(iso(result)).toEqual(["00:00", "00:30", "01:00", "01:30"]);
  });
});

describe("booking rules", () => {
  const now = new Date("2027-01-10T12:00:00Z");

  it("builds the online booking window", () => {
    const w = bookingWindow(now, { bookingLeadHours: 2, bookingHorizonDays: 30 });
    expect(w.earliest.toISOString()).toBe("2027-01-10T14:00:00.000Z");
    expect(w.firstDay).toBe("2027-01-10");
    expect(w.lastDay).toBe("2027-02-09");
  });

  it("allows changes only outside the notice period", () => {
    const booking = (hours: number, status = "confirmed") => ({
      status,
      startsAt: new Date(now.getTime() + hours * 3_600_000),
    });
    expect(canCustomerModify(booking(25), 24, now)).toBe(true);
    expect(canCustomerModify(booking(24), 24, now)).toBe(true);
    expect(canCustomerModify(booking(23), 24, now)).toBe(false);
    expect(canCustomerModify(booking(48, "cancelled"), 24, now)).toBe(false);
    expect(canCustomerModify(booking(1, "pending_payment"), 24, now)).toBe(true);
    expect(canCustomerModify(booking(1, "requested"), 24, now)).toBe(true);
  });
});
