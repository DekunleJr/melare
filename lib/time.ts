import { TZDate } from "@date-fns/tz";

/** The salon's local time zone. Everything is stored in UTC and shown in this zone. */
export const TIME_ZONE = "Europe/London";

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortDateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const dateKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const formatDateTime = (date: Date) => dateTimeFormat.format(date);
export const formatDate = (date: Date) => dateFormat.format(date);
export const formatShortDate = (date: Date) => shortDateFormat.format(date);
export const formatTime = (date: Date) => timeFormat.format(date);

/** Salon-local calendar day as YYYY-MM-DD. */
export const dateKey = (date: Date) => dateKeyFormat.format(date);

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function addDaysToKey(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekdayOfKey(key: string): number {
  return new Date(`${key}T00:00:00Z`).getUTCDay();
}

/**
 * Convert "minutes after local midnight" on a salon-local day to a UTC instant.
 * Returns null for wall-clock times that do not exist (spring clock change).
 */
export function zonedInstant(key: string, minute: number): Date | null {
  const [y, m, d] = key.split("-").map(Number);
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  const zoned = new TZDate(y, m - 1, d, hours, minutes, 0, TIME_ZONE);
  if (hours < 24 && (zoned.getHours() !== hours || zoned.getMinutes() !== minutes)) return null;
  return new Date(zoned.getTime());
}

/** UTC range covering one salon-local day. */
export function dayRange(key: string): { start: Date; end: Date } {
  return { start: zonedInstant(key, 0)!, end: zonedInstant(addDaysToKey(key, 1), 0)! };
}

/** Parse the value of an <input type="datetime-local"> as salon-local time. */
export function parseLocalDateTime(value: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match || !isDateKey(match[1])) return null;
  const minute = Number(match[2]) * 60 + Number(match[3]);
  if (minute >= 24 * 60) return null;
  return zonedInstant(match[1], minute);
}

export function minutesToTime(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const minute = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[2]) < 60 && minute <= 24 * 60 ? minute : null;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} hr` : "", m ? `${m} min` : ""].filter(Boolean).join(" ") || "0 min";
}
