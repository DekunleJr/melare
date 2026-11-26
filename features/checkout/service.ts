import "server-only";
import { and, asc, count, eq, gt, inArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  bookingAddons,
  bookingImages,
  bookings,
  deliveryMethods,
  discountCodes,
  mobileAreas,
  orderItems,
  orders,
  payments,
  productImages,
  productVariants,
  products,
  serviceAddons,
  services,
} from "@/db/schema";
import { canCustomerModify, occupiedBy } from "@/features/bookings/availability";
import {
  claimSlot,
  loadDay,
  lockBooking,
  occupying,
  staffForService,
  TAKEN,
} from "@/features/bookings/service";
import { tidyLines, takeStock, releaseOrderTx, type CartLine } from "@/features/orders/service";
import { insertPayment, releaseHeld, type Payment } from "@/features/payments/ledger";
import {
  deliversTo,
  deliveryPrice,
  depositDue,
  discountProblem,
  discountSplit,
  variantLabel,
  variantPrice,
} from "@/features/pricing";
import { UserError, withRetry } from "@/lib/errors";
import { matchPostcode, normalisePostcode } from "@/lib/postcode";
import { readSettings, type Settings } from "@/lib/settings";
import { dateKey } from "@/lib/time";
import { newNonce, newReference } from "@/lib/tokens";

/*
 * One checkout covers an appointment, a product order, or both. Prices, stock and
 * availability always come from the database, never from the browser.
 */

/** How long an unpaid checkout keeps its slot and stock. */
export const HOLD_MINUTES = 35;
export const MAX_UNPAID_PER_EMAIL = 3;

export type Address = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
};

export type BookingRequest = Address & {
  serviceId: number;
  staffId: number | null;
  start: Date;
  locationType: "salon" | "mobile";
  addonIds: number[];
  notes: string;
  /** Private file names of uploaded reference photos */
  images: string[];
};

export type OrderRequest = Address & {
  items: CartLine[];
  fulfilment: "delivery" | "pickup" | "appointment";
  deliveryMethodId: number | null;
  notes: string;
};

export type Contact = { customerName: string; customerEmail: string; customerPhone: string };

export type CheckoutRequest = Contact & {
  booking?: BookingRequest;
  order?: OrderRequest;
  discountCode: string;
  userId: string | null;
  /** Admin bookings skip online payment, notice periods, shift hours and approval. */
  source: "online" | "admin";
};

export type QuoteRequest = {
  booking?: {
    serviceId: number;
    locationType: "salon" | "mobile";
    postcode: string;
    addonIds: number[];
  };
  order?: {
    items: CartLine[];
    fulfilment: "delivery" | "pickup" | "appointment";
    deliveryMethodId: number | null;
    postcode: string;
  };
  discountCode: string;
  source?: "online" | "admin";
};

export async function mobileAreaFor(postcode: string) {
  const areas = await db.select().from(mobileAreas).where(eq(mobileAreas.active, true));
  return matchPostcode(areas, (a) => a.district, postcode);
}

async function priceBooking(
  request: NonNullable<QuoteRequest["booking"]>,
  rules: Settings,
  source: "online" | "admin",
) {
  const [service] = await db.select().from(services).where(eq(services.id, request.serviceId));
  const bookable =
    service && (source === "admin" ? service.status !== "archived" : service.status === "active");
  if (!bookable) throw new UserError("That service is not available to book.");

  const mobile = request.locationType === "mobile";
  if (
    (mobile && (service.locationMode === "salon" || (!rules.mobileEnabled && source === "online"))) ||
    (!mobile && service.locationMode === "mobile")
  ) {
    throw new UserError("That service is not offered at that location.");
  }

  const wanted = [...new Set(request.addonIds)];
  const addons = wanted.length
    ? await db
        .select()
        .from(serviceAddons)
        .where(
          and(
            inArray(serviceAddons.id, wanted),
            eq(serviceAddons.serviceId, service.id),
            eq(serviceAddons.active, true),
          ),
        )
        .orderBy(asc(serviceAddons.sortOrder), asc(serviceAddons.id))
    : [];
  if (addons.length !== wanted.length) {
    throw new UserError("One of the extras is no longer available. Please choose again.");
  }

  let area = null;
  if (mobile) {
    if (!normalisePostcode(request.postcode)) {
      throw new UserError("Enter a full UK postcode for your mobile appointment.");
    }
    area = await mobileAreaFor(request.postcode);
    if (!area) throw new UserError("Sorry, we do not travel to that postcode yet.");
  }

  const addonsPence = addons.reduce((n, a) => n + a.pricePence, 0);
  return {
    service,
    addons,
    addonsPence,
    travelFeePence: area?.feePence ?? 0,
    travelMinutes: area?.travelMinutes ?? 0,
    durationMinutes: service.durationMinutes + addons.reduce((n, a) => n + a.extraMinutes, 0),
    needsApproval:
      source === "online" &&
      (service.requiresApproval || (mobile && Boolean(rules.mobileNeedsApproval))),
  };
}

async function priceOrder(
  request: NonNullable<QuoteRequest["order"]>,
  rules: Settings,
  hasBooking: boolean,
  strict: boolean,
) {
  const items = tidyLines(request.items);
  if (!items.length) throw new UserError("Your bag is empty.");
  const rows = await db
    .select({ variant: productVariants, product: products })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, items.map((i) => i.variantId)));
  const images = rows.length
    ? await db
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, rows.map((r) => r.product.id)))
        .orderBy(asc(productImages.sortOrder), asc(productImages.id))
    : [];

  const lines = items.map(({ variantId, quantity }) => {
    const row = rows.find((r) => r.variant.id === variantId);
    if (!row || !row.variant.active || row.product.status !== "active") {
      throw new UserError(
        "An item in your bag is no longer available. Please remove it and try again.",
      );
    }
    const label = variantLabel(row.variant);
    if (row.variant.stock < quantity) {
      const name = label ? `${row.product.name} (${label})` : row.product.name;
      throw new UserError(
        row.variant.stock === 0
          ? `${name} is sold out.`
          : `Only ${row.variant.stock} of ${name} left in stock.`,
      );
    }
    return {
      variantId,
      productId: row.product.id,
      name: row.product.name,
      variantLabel: label,
      unitPricePence: variantPrice(row.variant),
      quantity,
      imagePath:
        row.variant.imagePath ??
        images.find((i) => i.productId === row.product.id)?.path ??
        null,
    };
  });
  const subtotalPence = lines.reduce((n, l) => n + l.unitPricePence * l.quantity, 0);

  let deliveryPence = 0;
  let deliveryMethodName = "";
  const deliveryOptions: { id: number; name: string; description: string; pricePence: number }[] = [];
  if (request.fulfilment === "appointment" && !hasBooking) {
    throw new UserError("Choose how you would like to receive your products.");
  }
  if (request.fulfilment === "pickup" && !rules.pickupEnabled) {
    throw new UserError("Collection is not available at the moment.");
  }
  if (request.fulfilment === "delivery") {
    const methods = await db
      .select()
      .from(deliveryMethods)
      .where(eq(deliveryMethods.active, true))
      .orderBy(asc(deliveryMethods.sortOrder), asc(deliveryMethods.id));
    const postcode = normalisePostcode(request.postcode);
    const offered = methods.filter((m) => (postcode ? deliversTo(m, postcode) : !m.postcodes));
    for (const m of offered) {
      deliveryOptions.push({
        id: m.id,
        name: m.name,
        description: m.description,
        pricePence: deliveryPrice(m, subtotalPence),
      });
    }
    const chosen =
      deliveryOptions.find((m) => m.id === request.deliveryMethodId) ??
      (strict ? undefined : deliveryOptions[0]);
    if (strict && !postcode) throw new UserError("Enter a full UK postcode for delivery.");
    if (strict && !chosen) {
      throw new UserError(
        deliveryOptions.length
          ? "Choose a delivery option."
          : "Sorry, we cannot deliver to that postcode.",
      );
    }
    deliveryPence = chosen?.pricePence ?? 0;
    deliveryMethodName = chosen?.name ?? "";
  }

  return { lines, subtotalPence, deliveryPence, deliveryMethodName, deliveryOptions };
}

async function findDiscount(code: string) {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const [row] = await db.select().from(discountCodes).where(eq(discountCodes.code, clean));
  return row ?? null;
}

/**
 * Price a basket. With `strict` false (live previews) a missing delivery choice or a
 * bad discount code is reported rather than thrown.
 */
export async function quote(request: QuoteRequest, strict = false, now = new Date()) {
  if (!request.booking && !request.order) throw new UserError("There is nothing to pay for.");
  const rules = await readSettings();
  const source = request.source ?? "online";
  const booking = request.booking ? await priceBooking(request.booking, rules, source) : null;
  const order = request.order
    ? await priceOrder(request.order, rules, Boolean(booking), strict)
    : null;

  const totals = {
    productsPence: order?.subtotalPence ?? 0,
    // Travel fees are not discounted.
    servicesPence: booking ? booking.service.pricePence + booking.addonsPence : 0,
  };
  let discount = null;
  let discountError = "";
  let split = { products: 0, services: 0 };
  if (request.discountCode.trim()) {
    const found = await findDiscount(request.discountCode);
    const problem = found ? discountProblem(found, totals, now) : "That code is not valid.";
    if (problem) {
      if (strict) throw new UserError(problem);
      discountError = problem;
    } else {
      discount = found!;
      split = discountSplit(discount, totals);
    }
  }

  const bookingTotal = booking
    ? totals.servicesPence + booking.travelFeePence - split.services
    : 0;
  const bookingDue =
    booking && source === "online" ? depositDue(booking.service, bookingTotal) : 0;
  const orderTotal = order ? order.subtotalPence + order.deliveryPence - split.products : 0;

  return {
    rules,
    booking: booking
      ? { ...booking, discountPence: split.services, totalPence: bookingTotal, duePence: bookingDue }
      : null,
    order: order ? { ...order, discountPence: split.products, totalPence: orderTotal } : null,
    discount: discount ? { id: discount.id, code: discount.code } : null,
    discountError,
    totalPence: bookingTotal + orderTotal,
    dueNowPence: bookingDue + orderTotal,
  };
}

export type Quote = Awaited<ReturnType<typeof quote>>;

/** Count one use, failing if the last one has just gone. */
async function claimDiscount(tx: Tx, id: number) {
  const [result] = await tx
    .update(discountCodes)
    .set({ usedCount: sql`${discountCodes.usedCount} + 1` })
    .where(
      and(
        eq(discountCodes.id, id),
        sql`(${discountCodes.maxUses} = 0 or ${discountCodes.usedCount} < ${discountCodes.maxUses})`,
      ),
    );
  if (result.affectedRows !== 1) throw new UserError("That code has been fully used.");
}

export type CheckoutResult = {
  bookingId: number | null;
  orderId: number | null;
  /** Present when money must be paid now */
  payment: Payment | null;
  needsApproval: boolean;
};

export async function createCheckout(
  request: CheckoutRequest,
  now = new Date(),
): Promise<CheckoutResult> {
  const { booking: wantedBooking, order: wantedOrder } = request;
  const priced = await quote(
    {
      booking: wantedBooking,
      order: wantedOrder,
      discountCode: request.discountCode,
      source: request.source,
    },
    true,
    now,
  );
  const { rules } = priced;
  const online = request.source === "online";
  const contact = {
    customerName: request.customerName,
    customerEmail: request.customerEmail,
    customerPhone: request.customerPhone,
  };

  if (wantedBooking && online) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.customerEmail, request.customerEmail),
          gt(bookings.startsAt, now),
          eq(bookings.paidPence, 0),
          occupying(now),
        ),
      );
    if (total >= MAX_UNPAID_PER_EMAIL) {
      throw new UserError(
        "You already have several upcoming bookings. Please contact the salon to add more.",
      );
    }
  }

  const needsApproval = priced.booking?.needsApproval ?? false;
  const dueNow = priced.dueNowPence;
  const status = needsApproval ? "requested" : dueNow > 0 ? "pending_payment" : "confirmed";
  let holdExpiresAt: Date | null = null;
  if (needsApproval) {
    holdExpiresAt = new Date(
      Math.min(
        now.getTime() + rules.approvalHoldHours * 3_600_000,
        wantedBooking!.start.getTime(),
      ),
    );
  } else if (dueNow > 0) {
    holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000);
  }

  async function writeOrder(tx: Tx, bookingId: number | null, claimCode: boolean) {
    const o = priced.order!;
    const wanted = wantedOrder!;
    for (const line of o.lines) {
      if (!(await takeStock(tx, line.variantId, line.quantity))) {
        throw new UserError(`Sorry, ${line.name} has just sold out. Please check your bag.`);
      }
    }
    const delivered = wanted.fulfilment === "delivery";
    const free = !needsApproval && dueNow === 0;
    const [{ id }] = await tx
      .insert(orders)
      .values({
        ...contact,
        number: newReference("ML"),
        userId: request.userId,
        bookingId,
        fulfilment: wanted.fulfilment,
        deliveryMethodName: o.deliveryMethodName,
        ...(delivered
          ? {
              addressLine1: wanted.addressLine1,
              addressLine2: wanted.addressLine2,
              city: wanted.city,
              postcode: normalisePostcode(wanted.postcode)!,
            }
          : {}),
        notes: wanted.notes,
        subtotalPence: o.subtotalPence,
        deliveryPence: o.deliveryPence,
        discountPence: o.discountPence,
        discountCode: o.discountPence ? priced.discount!.code : "",
        discountCodeId: claimCode ? priced.discount!.id : null,
        totalPence: o.totalPence,
        tokenNonce: newNonce(),
        status: free ? "paid" : "pending",
        paidAt: free ? now : null,
        expiresAt: holdExpiresAt,
      })
      .$returningId();
    await tx.insert(orderItems).values(o.lines.map((line) => ({ ...line, orderId: id })));
    return id;
  }

  const payNow = !needsApproval && dueNow > 0;

  if (!wantedBooking) {
    return withRetry(() =>
      db.transaction(async (tx) => {
        const code = priced.discount && priced.order!.discountPence > 0;
        const orderId = await writeOrder(tx, null, Boolean(code));
        if (code) await claimDiscount(tx, priced.discount!.id);
        const payment = payNow
          ? await insertPayment(tx, {
              userId: request.userId,
              orderId,
              bookingId: null,
              orderPence: priced.order!.totalPence,
              bookingPence: 0,
              expiresAt: holdExpiresAt,
            })
          : null;
        return { bookingId: null, orderId, payment, needsApproval: false };
      }),
    );
  }

  const plan = priced.booking!;
  const mobile = wantedBooking.locationType === "mobile";
  // Admin bookings may use anyone; the mobile flag only limits online requests.
  let people = await staffForService(plan.service.id, mobile && online);
  if (wantedBooking.staffId) people = people.filter((p) => p.id === wantedBooking.staffId);
  if (!people.length) throw new UserError("No stylist is available for that service.");
  if (people.length > 1) {
    // "Anyone available": try the least busy person first.
    const load = new Map<number, number>();
    for (const p of people) {
      load.set(p.id, (await loadDay(db, p.id, dateKey(wantedBooking.start), now)).busy.length);
    }
    people.sort((a, b) => load.get(a.id)! - load.get(b.id)!);
  }
  const shape = {
    durationMinutes: plan.durationMinutes,
    bufferMinutes: plan.service.bufferMinutes,
    travelMinutes: plan.travelMinutes,
  };
  const times = occupiedBy(
    wantedBooking.start,
    shape.durationMinutes,
    shape.bufferMinutes,
    shape.travelMinutes,
  );

  for (const person of people) {
    const created = await withRetry(() =>
      db.transaction(async (tx): Promise<CheckoutResult | null> => {
        const free = await claimSlot(
          tx,
          { staffId: person.id, start: wantedBooking.start, ...shape, source: request.source },
          rules,
          now,
        );
        if (!free) return null;

        const codeUsed =
          priced.discount &&
          (plan.discountPence > 0 || (priced.order?.discountPence ?? 0) > 0);
        if (codeUsed) await claimDiscount(tx, priced.discount!.id);

        const [{ id: bookingId }] = await tx
          .insert(bookings)
          .values({
            ...contact,
            reference: newReference("BK"),
            userId: request.userId,
            serviceId: plan.service.id,
            staffId: person.id,
            serviceName: plan.service.name,
            staffName: person.name,
            startsAt: times.start,
            endsAt: times.end,
            blockedFrom: times.blockedFrom,
            blockedUntil: times.blockedUntil,
            locationType: wantedBooking.locationType,
            ...(mobile
              ? {
                  addressLine1: wantedBooking.addressLine1,
                  addressLine2: wantedBooking.addressLine2,
                  city: wantedBooking.city,
                  postcode: normalisePostcode(wantedBooking.postcode)!,
                }
              : {}),
            travelMinutes: plan.travelMinutes,
            pricePence: plan.service.pricePence,
            addonsPence: plan.addonsPence,
            travelFeePence: plan.travelFeePence,
            discountPence: plan.discountPence,
            discountCode: plan.discountPence ? priced.discount!.code : "",
            // The use is counted against the appointment even if only products were discounted.
            discountCodeId: codeUsed ? priced.discount!.id : null,
            totalPence: plan.totalPence,
            paymentMode: plan.duePence > 0 ? plan.service.paymentMode : "pay_at_salon",
            amountDuePence: plan.duePence,
            status,
            paymentStatus: plan.duePence > 0 ? "unpaid" : "not_required",
            notes: wantedBooking.notes,
            tokenNonce: newNonce(),
            holdExpiresAt,
          })
          .$returningId();
        if (plan.addons.length) {
          await tx.insert(bookingAddons).values(
            plan.addons.map((a) => ({
              bookingId,
              name: a.name,
              pricePence: a.pricePence,
              extraMinutes: a.extraMinutes,
            })),
          );
        }
        if (wantedBooking.images.length) {
          await tx
            .insert(bookingImages)
            .values(wantedBooking.images.map((fileName) => ({ bookingId, fileName })));
        }
        const orderId = priced.order ? await writeOrder(tx, bookingId, false) : null;
        const payment = payNow
          ? await insertPayment(tx, {
              userId: request.userId,
              orderId,
              bookingId,
              orderPence: priced.order?.totalPence ?? 0,
              bookingPence: plan.duePence,
              expiresAt: holdExpiresAt,
            })
          : null;
        return { bookingId, orderId, payment, needsApproval };
      }),
    );
    if (created) return created;
  }
  throw new UserError(TAKEN);
}

async function pendingOrderFor(tx: Tx, bookingId: number) {
  const [order] = await tx
    .select()
    .from(orders)
    .where(and(eq(orders.bookingId, bookingId), eq(orders.status, "pending")))
    .for("update");
  return order;
}

/** Accept a requested appointment. The customer then pays, if anything is due. */
export async function approveBooking(id: number, now = new Date()): Promise<CheckoutResult> {
  const [existing] = await db.select().from(bookings).where(eq(bookings.id, id));
  if (!existing) throw new UserError("Booking not found.");
  const rules = await readSettings();
  const minutes = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;

  return withRetry(() =>
    db.transaction(async (tx) => {
      const free = await claimSlot(
        tx,
        {
          staffId: existing.staffId,
          start: existing.startsAt,
          durationMinutes: minutes(existing.startsAt, existing.endsAt),
          travelMinutes: existing.travelMinutes,
          bufferMinutes: minutes(existing.endsAt, existing.blockedUntil) - existing.travelMinutes,
          source: "admin",
          excludeBookingId: id,
        },
        rules,
        now,
      );
      const booking = await lockBooking(tx, id);
      if (!booking || booking.status !== "requested") {
        throw new UserError("This request has already been dealt with.");
      }
      if (booking.startsAt <= now) throw new UserError("The requested time has passed.");
      if (!free) throw new UserError("That time has since been booked. Decline this request.");

      const order = await pendingOrderFor(tx, id);
      const due = booking.amountDuePence + (order?.totalPence ?? 0);
      if (due === 0) {
        await tx
          .update(bookings)
          .set({ status: "confirmed", holdExpiresAt: null })
          .where(eq(bookings.id, id));
        return { bookingId: id, orderId: null, payment: null, needsApproval: false };
      }
      const expiresAt = new Date(
        Math.min(
          now.getTime() + rules.paymentLinkHours * 3_600_000,
          booking.startsAt.getTime(),
        ),
      );
      await tx
        .update(bookings)
        .set({ status: "pending_payment", holdExpiresAt: expiresAt })
        .where(eq(bookings.id, id));
      if (order) await tx.update(orders).set({ expiresAt }).where(eq(orders.id, order.id));
      const payment = await insertPayment(tx, {
        userId: booking.userId,
        orderId: order?.id ?? null,
        bookingId: id,
        orderPence: order?.totalPence ?? 0,
        bookingPence: booking.amountDuePence,
        expiresAt,
      });
      return { bookingId: id, orderId: order?.id ?? null, payment, needsApproval: false };
    }),
  );
}

export async function declineBooking(id: number) {
  return withRetry(() =>
    db.transaction(async (tx) => {
      const booking = await lockBooking(tx, id);
      if (!booking || booking.status !== "requested") {
        throw new UserError("This request has already been dealt with.");
      }
      await releaseHeld(tx, { bookingId: id, orderId: null }, "cancelled");
      await tx.update(bookings).set({ status: "declined" }).where(eq(bookings.id, id));
      const order = await pendingOrderFor(tx, id);
      if (order) await releaseOrderTx(tx, order.id, "cancelled");
    }),
  );
}

/**
 * Cancel an appointment. An unpaid or unapproved one releases everything in its
 * checkout. A confirmed one leaves any paid product order in place. Refunds are a
 * separate step.
 */
export async function cancelBooking(id: number, by: "customer" | "admin", now = new Date()) {
  const rules = await readSettings();
  return withRetry(() =>
    db.transaction(async (tx) => {
      const waiting = await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.bookingId, id),
            inArray(payments.status, ["pending", "capturing", "processing"]),
          ),
        )
        .for("update");
      if (waiting.some((p) => p.status !== "pending")) {
        throw new UserError("A payment is being processed. Please try again in a few minutes.");
      }
      const booking = await lockBooking(tx, id);
      if (!booking || !["requested", "confirmed", "pending_payment"].includes(booking.status)) {
        throw new UserError("This booking can no longer be cancelled.");
      }
      if (by === "customer" && !canCustomerModify(booking, rules.cancellationNoticeHours, now)) {
        throw new UserError(
          "It is too close to your appointment to cancel online. Please contact the salon.",
        );
      }
      for (const payment of waiting) {
        await tx.update(payments).set({ status: "cancelled" }).where(eq(payments.id, payment.id));
      }
      if (booking.status === "confirmed") {
        await tx
          .update(bookings)
          .set({ status: "cancelled", cancelledAt: now, holdExpiresAt: null })
          .where(eq(bookings.id, id));
      } else {
        const order = await pendingOrderFor(tx, id);
        await releaseHeld(tx, { bookingId: id, orderId: order?.id ?? null }, "cancelled");
      }
      return booking;
    }),
  );
}
