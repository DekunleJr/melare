import "server-only";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { sendCartReminders } from "@/features/carts";
import { sendReminder } from "@/features/notifications";
import { releaseStale, type Effects } from "@/features/payments/process";
import { backupIfDue } from "@/lib/backup";

export async function sendDueReminders(now = new Date()) {
  const due = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, "confirmed"),
        isNull(bookings.reminderSentAt),
        gt(bookings.startsAt, now),
        lt(bookings.startsAt, new Date(now.getTime() + 24 * 3_600_000)),
      ),
    )
    .limit(100);
  for (const booking of due) await sendReminder(booking.id);
  return due.length;
}

/** Everything the site does on its own, run every few minutes. */
export async function runScheduledTasks(effects: Effects) {
  const result = { reminders: 0, released: 0, cartReminders: 0, backup: null as string | null };
  // One failing task must not stop the others.
  const attempt = async (name: string, work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      console.error(`Scheduled task "${name}" failed`, error);
    }
  };
  await attempt("clean-up", async () => {
    result.released = await releaseStale(effects);
  });
  await attempt("reminders", async () => {
    result.reminders = await sendDueReminders();
  });
  await attempt("basket reminders", async () => {
    result.cartReminders = await sendCartReminders();
  });
  await attempt("backup", async () => {
    result.backup = await backupIfDue();
  });
  return result;
}
