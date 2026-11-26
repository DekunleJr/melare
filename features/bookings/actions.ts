"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidateTag, updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { serviceAddons, services } from "@/db/schema";
import { accessBooking, type Access } from "@/features/access";
import { cancelBooking, mobileAreaFor } from "@/features/checkout/service";
import { notifyBooking } from "@/features/notifications";
import { balancePayment } from "@/features/payments/ledger";
import { requirePaypal } from "@/features/payments/paypal";
import { refundableAmount, refundTarget } from "@/features/payments/process";
import { runAction } from "@/lib/actions";
import { UserError } from "@/lib/errors";
import type { FormState } from "@/lib/forms";
import { allowRequest } from "@/lib/rate-limit";
import { TAGS } from "@/lib/tags";
import { isDateKey } from "@/lib/time";
import { manageToken } from "@/lib/tokens";
import { bookingShape, getAvailability, rescheduleBooking } from "./service";

const slotQuery = z.object({
  serviceId: z.number().int().positive(),
  staffId: z.number().int().positive().nullable(),
  dateKey: z.string().refine(isDateKey),
  locationType: z.enum(["salon", "mobile"]),
  postcode: z.string().max(20),
  addonIds: z.array(z.number().int().positive()).max(30),
});

/** Free start times (ISO strings) for a new booking. */
export async function fetchSlots(input: z.input<typeof slotQuery>): Promise<string[]> {
  const query = slotQuery.safeParse(input);
  if (!query.success || !(await allowRequest("slots", 120, 5))) return [];
  const { serviceId, addonIds, locationType, postcode } = query.data;
  const [service] = await db.select().from(services).where(eq(services.id, serviceId));
  if (!service || service.status !== "active") return [];
  const mobile = locationType === "mobile";
  const area = mobile ? await mobileAreaFor(postcode) : null;
  if (mobile && !area) return [];
  const addons = addonIds.length
    ? await db
        .select()
        .from(serviceAddons)
        .where(and(inArray(serviceAddons.id, addonIds), eq(serviceAddons.serviceId, serviceId)))
    : [];
  const slots = await getAvailability({
    serviceId,
    staffId: query.data.staffId,
    dateKey: query.data.dateKey,
    durationMinutes: service.durationMinutes + addons.reduce((n, a) => n + a.extraMinutes, 0),
    bufferMinutes: service.bufferMinutes,
    travelMinutes: area?.travelMinutes ?? 0,
    mobile,
  });
  return slots.map((s) => s.start.toISOString());
}

/** Free start times when moving an existing booking (same stylist, same length). */
export async function fetchRescheduleSlots(access: Access, key: string): Promise<string[]> {
  if (!isDateKey(key) || !(await allowRequest("slots", 120, 5))) return [];
  const booking = await accessBooking(access);
  if (!booking) return [];
  const slots = await getAvailability({
    serviceId: booking.serviceId,
    staffId: booking.staffId,
    dateKey: key,
    ...bookingShape(booking),
    excludeBookingId: booking.id,
  });
  return slots.map((s) => s.start.toISOString());
}

export async function customerCancelBooking(access: Access): Promise<FormState> {
  return runAction(async () => {
    const booking = await accessBooking(access);
    if (!booking) throw new UserError("Booking not found.");
    await cancelBooking(booking.id, "customer");
    updateTag(TAGS.products);
    let refundNote = "";
    try {
      const target = { bookingId: booking.id };
      const amount = await refundableAmount(target);
      if (amount > 0) {
        const { manualPence } = await refundTarget(target, amount, "Cancelled by customer");
        if (manualPence) refundNote = " The salon will arrange the rest of your refund.";
      }
    } catch (error) {
      refundNote = " We could not process the refund automatically, so the salon will arrange it.";
      console.error(`Refund for booking ${booking.id} failed`, error);
    }
    after(() => notifyBooking(booking.id, "cancelled"));
    after(() => revalidateTag(TAGS.products, { expire: 0 }));
    return { ok: true, message: `Your booking is cancelled.${refundNote}` };
  });
}

export async function customerReschedule(
  access: Access,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  return runAction(async () => {
    if (!(await allowRequest("reschedule", 10, 10))) {
      throw new UserError("Too many attempts. Please wait a few minutes.");
    }
    const start = z.iso.datetime().safeParse(formData.get("start"));
    if (!start.success) throw new UserError("Choose a new time first.");
    const booking = await accessBooking(access);
    if (!booking) throw new UserError("Booking not found.");
    await rescheduleBooking(booking.id, new Date(start.data), "customer");
    after(() => notifyBooking(booking.id, "rescheduled"));
    return { ok: true, message: "Your booking has been moved." };
  });
}

/** Open the payment page for whatever is still owed. */
export async function payBalance(access: Access): Promise<FormState> {
  return runAction(async () => {
    const booking = await accessBooking(access);
    if (!booking) throw new UserError("Booking not found.");
    requirePaypal();
    const payment = await balancePayment(booking.id);
    return { url: `/pay/${manageToken("payment", payment)}` };
  });
}
