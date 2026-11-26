/*
 * Checks the money and booking logic against a real database, with a local
 * stand-in for PayPal. Nothing is sent anywhere.
 *   npm run test:integration
 * It creates temporary records and removes them. Use a test database, not a live one.
 */
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import { and, eq, inArray, like } from "drizzle-orm";
import { closeDb, db } from "@/db";
import {
  bookings,
  deliveryMethods,
  discountCodes,
  emailLog,
  mobileAreas,
  orders,
  payments,
  productVariants,
  products,
  refunds,
  savedCarts,
  serviceAddons,
  services,
  staff,
  staffServices,
  webhookEvents,
  workingHours,
} from "@/db/schema";
import { getAvailability, getBooking, rescheduleBooking } from "@/features/bookings/service";
import { saveCart, sendCartReminders } from "@/features/carts";
import {
  approveBooking,
  cancelBooking,
  createCheckout,
  declineBooking,
  type CheckoutRequest,
} from "@/features/checkout/service";
import { cancelPaidOrder, getOrder, releaseOrder } from "@/features/orders/service";
import {
  balanceDue,
  balancePayment,
  closePayment,
  getPayment,
  paymentsFor,
  recordManualPayment,
  type Payment,
} from "@/features/payments/ledger";
import {
  capturePayment,
  handlePaypalEvent,
  refundTarget,
  releaseStale,
  startPayment,
} from "@/features/payments/process";
import { addDaysToKey, dateKey } from "@/lib/time";
import { manageToken, parseTokenId, verifyToken } from "@/lib/tokens";

// ---------- A stand-in for the parts of PayPal this site calls ----------

type FakeOrder = {
  id: string;
  custom_id: string;
  value: string;
  capture?: { id: string; status: string; amount: { currency_code: string; value: string } };
};

const fake = {
  orders: new Map<string, FakeOrder>(),
  refunds: [] as { captureId: string; value: string; requestId: string }[],
  /** How the next capture should behave */
  next: "COMPLETED" as "COMPLETED" | "PENDING" | "DECLINE" | "ERROR_BUT_CAPTURED",
  captures: 0,
  refundsFail: false,
};

const body = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(raw));
  });

const server = createServer(async (req, res) => {
  const raw = await body(req);
  const send = (status: number, data: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
  };
  const url = req.url!;
  const view = (o: FakeOrder) => ({
    id: o.id,
    status: o.capture ? "COMPLETED" : "APPROVED",
    purchase_units: [
      { custom_id: o.custom_id, payments: o.capture ? { captures: [o.capture] } : undefined },
    ],
  });
  if (url === "/v1/oauth2/token") return send(200, { access_token: "t", expires_in: 3600 });
  if (url === "/v2/checkout/orders") {
    const unit = JSON.parse(raw).purchase_units[0];
    const id = `PPO${run}${fake.orders.size}`;
    fake.orders.set(id, { id, custom_id: unit.custom_id, value: unit.amount.value });
    return send(201, { id, status: "CREATED" });
  }
  let match = /^\/v2\/checkout\/orders\/([^/]+)\/capture$/.exec(url);
  if (match) {
    const order = fake.orders.get(match[1])!;
    const mode = fake.next;
    fake.next = "COMPLETED";
    if (mode === "DECLINE") {
      return send(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "INSTRUMENT_DECLINED" }] });
    }
    fake.captures++;
    order.capture = {
      id: `CAP${order.id}`,
      status: mode === "PENDING" ? "PENDING" : "COMPLETED",
      amount: { currency_code: "GBP", value: order.value },
    };
    if (mode === "ERROR_BUT_CAPTURED") return send(500, { name: "INTERNAL_SERVER_ERROR" });
    return send(201, view(order));
  }
  match = /^\/v2\/checkout\/orders\/([^/]+)$/.exec(url);
  if (match) return send(200, view(fake.orders.get(match[1])!));
  match = /^\/v2\/payments\/captures\/([^/]+)\/refund$/.exec(url);
  if (match) {
    if (fake.refundsFail) return send(422, { name: "UNPROCESSABLE_ENTITY" });
    const requestId = String(req.headers["paypal-request-id"]);
    const existing = fake.refunds.findIndex((r) => r.requestId === requestId);
    if (existing >= 0) return send(200, { id: `REF${run}${existing}`, status: "COMPLETED" });
    fake.refunds.push({ captureId: match[1], value: JSON.parse(raw).amount.value, requestId });
    return send(201, { id: `REF${run}${fake.refunds.length - 1}`, status: "COMPLETED" });
  }
  send(404, {});
});

const run = Date.now().toString(36);
// Never send real email or take real money from tests.
process.env.RESEND_API_KEY = "";
process.env.PAYPAL_ENV = "sandbox";
process.env.PAYPAL_CLIENT_ID = "test-client";
process.env.PAYPAL_CLIENT_SECRET = "test-secret";
process.env.PAYPAL_API_BASE = "http://127.0.0.1:4598";

const emails: Promise<unknown>[] = [];
const effects = { defer: (task: () => Promise<unknown>) => void emails.push(task()) };
const settle = () => Promise.all(emails.splice(0));

const created = {
  services: [] as number[],
  staff: [] as number[],
  products: [] as number[],
  areas: [] as number[],
  codes: [] as number[],
  methods: [] as number[],
};
const eventIds: string[] = [];
let passed = 0;

async function check(name: string, run: () => Promise<void>) {
  try {
    await run();
    await settle();
  } catch (error) {
    console.error(`  FAIL  ${name}`);
    throw error;
  }
  passed++;
  console.log(`  ok  ${name}`);
}

// ---------- Test data ----------

const person = (n = 0) => ({
  customerName: "Integration Test",
  customerEmail: `it-${run}-${n}@example.test`,
  customerPhone: "07700900000",
});
const noAddress = { addressLine1: "", addressLine2: "", city: "", postcode: "" };
const home = { addressLine1: "1 Test Road", addressLine2: "", city: "Test", postcode: "ZZ9 9ZZ" };

async function newVariant(stock: number, pricePence = 1000) {
  const n = created.products.length;
  const [{ id }] = await db
    .insert(products)
    .values({ name: `IT product ${run}-${n}`, slug: `it-${run}-${n}`, description: "test" })
    .$returningId();
  created.products.push(id);
  const [variant] = await db
    .insert(productVariants)
    .values({ productId: id, pricePence, stock, colour: "Black" })
    .$returningId();
  return variant.id;
}

const stockOf = async (id: number) =>
  (await db.select().from(productVariants).where(eq(productVariants.id, id)))[0].stock;

async function newStaff(offersMobile = false) {
  const [{ id }] = await db
    .insert(staff)
    .values({ name: `IT staff ${run}-${created.staff.length}`, bio: "", offersMobile })
    .$returningId();
  created.staff.push(id);
  await db.insert(workingHours).values(
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      staffId: id,
      weekday,
      startMinute: 8 * 60,
      endMinute: 20 * 60,
    })),
  );
  return id;
}

async function newService(
  people: number[],
  values: Partial<typeof services.$inferInsert> = {},
) {
  const n = created.services.length;
  const [{ id }] = await db
    .insert(services)
    .values({
      name: `IT service ${run}-${n}`,
      slug: `it-${run}-${n}`,
      description: "test",
      durationMinutes: 60,
      pricePence: 4000,
      ...values,
    })
    .$returningId();
  created.services.push(id);
  await db.insert(staffServices).values(people.map((staffId) => ({ staffId, serviceId: id })));
  return id;
}

const day = addDaysToKey(dateKey(new Date()), 10);

function request(
  who: number,
  parts: {
    service?: number;
    start?: Date;
    staffId?: number;
    addonIds?: number[];
    mobile?: boolean;
    items?: { variantId: number; quantity: number }[];
    fulfilment?: "delivery" | "pickup" | "appointment";
    deliveryMethodId?: number;
    code?: string;
    source?: "online" | "admin";
  },
): CheckoutRequest {
  return {
    ...person(who),
    userId: null,
    source: parts.source ?? "online",
    discountCode: parts.code ?? "",
    booking: parts.service
      ? {
          serviceId: parts.service,
          staffId: parts.staffId ?? null,
          start: parts.start!,
          locationType: parts.mobile ? "mobile" : "salon",
          addonIds: parts.addonIds ?? [],
          notes: "",
          images: [],
          ...(parts.mobile ? home : noAddress),
        }
      : undefined,
    order: parts.items
      ? {
          items: parts.items,
          fulfilment: parts.fulfilment ?? "pickup",
          deliveryMethodId: parts.deliveryMethodId ?? null,
          notes: "",
          ...(parts.fulfilment === "delivery" ? home : noAddress),
        }
      : undefined,
  };
}

/** Approve in PayPal and capture, as the payment page does. */
async function pay(payment: Payment) {
  const paypalOrder = await startPayment(payment.id, "paypal");
  const result = await capturePayment(payment.id, paypalOrder, effects);
  await settle();
  return { result, paypalOrder };
}

function event(type: string, resource: Record<string, unknown>) {
  const id = `WH-${run}-${eventIds.length}`;
  eventIds.push(id);
  return { id, event_type: type, resource };
}

async function main() {
  await new Promise<void>((resolve) => server.listen(4598, "127.0.0.1", resolve));
  const anna = await newStaff(true);
  const ben = await newStaff();
  const solo = await newService([anna]);
  const pair = await newService([anna, ben]);
  const first = (
    await getAvailability({ serviceId: solo, dateKey: day, durationMinutes: 60, bufferMinutes: 0 })
  )[0].start;
  const hour = (n: number, dayOffset = 0) =>
    new Date(first.getTime() + n * 3_600_000 + dayOffset * 86_400_000);

  console.log("Bookings");
  await check("8 simultaneous requests for one slot make exactly one booking", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        createCheckout(request(i + 1, { service: solo, start: hour(0) })),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  });

  await check('"anyone" fills each stylist once, then refuses', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        createCheckout(request(i + 20, { service: pair, start: hour(1) })),
      ),
    );
    const made = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    assert.equal(made.length, 2);
    const who = await Promise.all(made.map(async (m) => (await getBooking(m.bookingId!))!.staffId));
    assert.equal(new Set(who).size, 2);
  });

  await check("unpaid bookings per email are capped; admin bookings ignore the cap", async () => {
    for (const n of [3, 4, 5]) await createCheckout(request(50, { service: solo, start: hour(n) }));
    await assert.rejects(
      createCheckout(request(50, { service: solo, start: hour(6) })),
      /several upcoming bookings/,
    );
    await createCheckout(request(50, { service: solo, start: hour(6), source: "admin" }));
  });

  await check("reschedule refuses a taken time and frees the old one", async () => {
    const made = await createCheckout(request(60, { service: solo, start: hour(2) }));
    await assert.rejects(rescheduleBooking(made.bookingId!, hour(3), "customer"));
    await rescheduleBooking(made.bookingId!, hour(8), "customer");
    await createCheckout(request(61, { service: solo, start: hour(2) }));
  });

  await check("late customer cancellation is refused", async () => {
    const made = await createCheckout(request(70, { service: solo, start: hour(7) }));
    const late = new Date(hour(7).getTime() - 3_600_000);
    await assert.rejects(cancelBooking(made.bookingId!, "customer", late), /too close/);
    await cancelBooking(made.bookingId!, "customer");
    await createCheckout(request(71, { service: solo, start: hour(7) }));
  });

  console.log("Extras, mobile visits and approval");
  const [{ id: areaId }] = await db
    .insert(mobileAreas)
    .values({ district: "ZZ9", feePence: 1500, travelMinutes: 60 })
    .$returningId();
  created.areas.push(areaId);
  const mobile = await newService([anna, ben], {
    locationMode: "both",
    paymentMode: "deposit",
    depositType: "percent",
    depositPercent: 25,
  });
  const [{ id: addon }] = await db
    .insert(serviceAddons)
    .values({ serviceId: mobile, name: "Extra length", pricePence: 1000, extraMinutes: 30 })
    .$returningId();

  await check("extras add price and time; travel adds a fee and blocks the diary", async () => {
    const made = await createCheckout(
      request(80, { service: mobile, start: hour(2, 1), mobile: true, addonIds: [addon] }),
    );
    const b = (await getBooking(made.bookingId!))!;
    assert.equal(b.totalPence, 4000 + 1000 + 1500);
    assert.equal(b.amountDuePence, Math.round(6500 * 0.25));
    assert.equal(b.staffId, anna, "only mobile staff travel");
    assert.equal((b.endsAt.getTime() - b.startsAt.getTime()) / 60000, 90);
    assert.equal((b.startsAt.getTime() - b.blockedFrom.getTime()) / 60000, 60);
    assert.equal((b.blockedUntil.getTime() - b.endsAt.getTime()) / 60000, 60);
    assert.equal(b.status, "requested", "mobile visits wait for approval by default");
    assert.equal(made.payment, null);
    // The journey time before the visit cannot be booked.
    await assert.rejects(
      createCheckout(request(81, { service: solo, start: hour(1, 1), source: "online" })),
      /just been taken/,
    );
  });

  await check("a mobile visit outside the covered postcodes is refused", async () => {
    const bad = request(82, { service: mobile, start: hour(6, 1), mobile: true });
    bad.booking!.postcode = "ZZ8 1AA";
    await assert.rejects(createCheckout(bad), /do not travel/);
  });

  await check("approval creates a payment; paying confirms the booking", async () => {
    const made = await createCheckout(request(83, { service: mobile, start: hour(2, 2), mobile: true }));
    const approved = await approveBooking(made.bookingId!);
    assert.equal(approved.payment!.amountPence, Math.round(5500 * 0.25));
    assert.equal((await getBooking(made.bookingId!))!.status, "pending_payment");
    await assert.rejects(approveBooking(made.bookingId!), /already been dealt with/);
    assert.equal((await pay(approved.payment!)).result, "completed");
    const b = (await getBooking(made.bookingId!))!;
    assert.equal(b.status, "confirmed");
    assert.equal(balanceDue(b), 5500 - Math.round(5500 * 0.25));
  });

  await check("declining a request releases its products", async () => {
    const hair = await newVariant(5);
    const made = await createCheckout(
      request(84, {
        service: mobile,
        start: hour(6, 2),
        mobile: true,
        items: [{ variantId: hair, quantity: 2 }],
        fulfilment: "appointment",
      }),
    );
    assert.equal(await stockOf(hair), 3);
    await declineBooking(made.bookingId!);
    assert.equal(await stockOf(hair), 5);
    assert.equal((await getBooking(made.bookingId!))!.status, "declined");
    assert.equal((await getOrder(made.orderId!))!.status, "cancelled");
  });

  await check("an unanswered request expires and releases its slot and stock", async () => {
    const hair = await newVariant(5);
    const made = await createCheckout(
      request(85, {
        service: mobile,
        start: hour(2, 3),
        mobile: true,
        items: [{ variantId: hair, quantity: 1 }],
        fulfilment: "appointment",
      }),
    );
    await db.update(bookings).set({ holdExpiresAt: new Date(Date.now() - 1000) }).where(eq(bookings.id, made.bookingId!));
    await releaseStale(effects);
    assert.equal((await getBooking(made.bookingId!))!.status, "expired");
    assert.equal(await stockOf(hair), 5);
  });

  console.log("One checkout for products and an appointment");
  const prepaid = await newService([anna], { paymentMode: "full" });
  let combined: Awaited<ReturnType<typeof createCheckout>>;
  let combinedStock = 0;
  await check("one payment covers both and confirms both", async () => {
    combinedStock = await newVariant(10, 700);
    combined = await createCheckout(
      request(90, {
        service: prepaid,
        start: hour(2, 4),
        items: [{ variantId: combinedStock, quantity: 3 }],
        fulfilment: "appointment",
      }),
    );
    assert.equal(combined.payment!.amountPence, 4000 + 2100);
    assert.equal(combined.payment!.bookingPence, 4000);
    assert.equal(combined.payment!.orderPence, 2100);
    assert.equal(await stockOf(combinedStock), 7);
    await pay(combined.payment!);
    assert.equal((await getBooking(combined.bookingId!))!.status, "confirmed");
    assert.equal((await getOrder(combined.orderId!))!.status, "paid");
    const receipts = await db
      .select()
      .from(emailLog)
      .where(eq(emailLog.toAddress, `it-${run}-90@example.test`));
    assert.deepEqual(receipts.map((r) => r.kind).sort(), ["booking_confirmed", "order_receipt"]);
  });

  await check("capturing twice, or a repeated notification, charges and confirms once", async () => {
    const before = fake.captures;
    const p = (await getPayment(combined.payment!.id))!;
    assert.equal(await capturePayment(p.id, p.paypalOrderId!, effects), "completed");
    const note = event("PAYMENT.CAPTURE.COMPLETED", {
      id: p.captureId,
      amount: { currency_code: "GBP", value: "61.00" },
      supplementary_data: { related_ids: { order_id: p.paypalOrderId } },
    });
    await handlePaypalEvent(note, effects);
    await handlePaypalEvent(note, effects);
    assert.equal(fake.captures, before);
    assert.equal((await getBooking(combined.bookingId!))!.paidPence, 4000);
  });

  await check("a partial refund goes to PayPal and is counted once", async () => {
    await refundTarget({ bookingId: combined.bookingId! }, 1500, "goodwill");
    assert.equal(fake.refunds.at(-1)!.value, "15.00");
    const id = `REF${run}${fake.refunds.length - 1}`;
    await handlePaypalEvent(
      event("PAYMENT.CAPTURE.REFUNDED", {
        id,
        amount: { currency_code: "GBP", value: "15.00" },
        links: [{ rel: "up", href: `https://x/v2/payments/captures/${(await getPayment(combined.payment!.id))!.captureId}` }],
      }),
      effects,
    );
    const b = (await getBooking(combined.bookingId!))!;
    assert.equal(b.refundedPence, 1500);
    assert.equal(b.paymentStatus, "partially_refunded");
    await assert.rejects(refundTarget({ bookingId: b.id }, 2600, ""), /refund up to/);
  });

  await check("a refund made in PayPal is recorded", async () => {
    const p = (await getPayment(combined.payment!.id))!;
    await handlePaypalEvent(
      event("PAYMENT.CAPTURE.REFUNDED", {
        id: `EXT${run}`,
        amount: { currency_code: "GBP", value: "21.00" },
        links: [{ rel: "up", href: `https://x/v2/payments/captures/${p.captureId}` }],
      }),
      effects,
    );
    const order = (await getOrder(combined.orderId!))!;
    assert.equal(order.refundedPence, 2100);
    assert.equal(order.status, "refunded");
    assert.equal(await stockOf(combinedStock), 10);
  });

  await check("abandoning a combined checkout releases both", async () => {
    const hair = await newVariant(4);
    const made = await createCheckout(
      request(91, {
        service: prepaid,
        start: hour(5, 4),
        items: [{ variantId: hair, quantity: 4 }],
        fulfilment: "appointment",
      }),
    );
    await db.update(payments).set({ expiresAt: new Date(Date.now() - 600_000) }).where(eq(payments.id, made.payment!.id));
    await releaseStale(effects);
    assert.equal((await getBooking(made.bookingId!))!.status, "expired");
    assert.equal((await getOrder(made.orderId!))!.status, "expired");
    assert.equal(await stockOf(hair), 4);
  });

  await check("money is never taken for something already released", async () => {
    const made = await createCheckout(request(92, { service: prepaid, start: hour(8, 4) }));
    const paypalOrder = await startPayment(made.payment!.id, "paypal");
    await closePayment(made.payment!.id, "expired");
    const before = fake.captures;
    assert.equal(await capturePayment(made.payment!.id, paypalOrder, effects), "unavailable");
    assert.equal(fake.captures, before);
    await assert.rejects(startPayment(made.payment!.id, "paypal"), /no longer available/);
  });

  await check("only the latest PayPal order for a payment can be captured", async () => {
    const made = await createCheckout(request(93, { service: prepaid, start: hour(2, 5) }));
    const old = await startPayment(made.payment!.id, "paypal");
    const latest = await startPayment(made.payment!.id, "other");
    assert.equal(await capturePayment(made.payment!.id, old, effects), "unavailable");
    assert.equal(await capturePayment(made.payment!.id, latest, effects), "completed");
  });

  await check("a declined card can try again", async () => {
    const made = await createCheckout(request(94, { service: prepaid, start: hour(4, 5) }));
    fake.next = "DECLINE";
    assert.equal((await pay(made.payment!)).result, "declined");
    assert.equal((await getPayment(made.payment!.id))!.status, "pending");
    assert.equal((await pay(made.payment!)).result, "completed");
  });

  await check("an error after PayPal took the money is recovered", async () => {
    const made = await createCheckout(request(95, { service: prepaid, start: hour(6, 5) }));
    fake.next = "ERROR_BUT_CAPTURED";
    assert.equal((await pay(made.payment!)).result, "completed");
    assert.equal((await getBooking(made.bookingId!))!.status, "confirmed");
  });

  await check("a payment under review confirms when PayPal says so", async () => {
    const made = await createCheckout(request(96, { service: prepaid, start: hour(8, 5) }));
    fake.next = "PENDING";
    const { result, paypalOrder } = await pay(made.payment!);
    assert.equal(result, "pending");
    await assert.rejects(cancelBooking(made.bookingId!, "customer"), /being processed/);
    await releaseStale(effects);
    assert.equal((await getBooking(made.bookingId!))!.status, "pending_payment");
    await handlePaypalEvent(
      event("PAYMENT.CAPTURE.COMPLETED", {
        id: `CAP${paypalOrder}`,
        amount: { currency_code: "GBP", value: "40.00" },
        supplementary_data: { related_ids: { order_id: paypalOrder } },
      }),
      effects,
    );
    assert.equal((await getBooking(made.bookingId!))!.status, "confirmed");
  });

  console.log("Balances");
  await check("cash and an online link settle a balance", async () => {
    const service = await newService([ben], {
      paymentMode: "deposit",
      depositPence: 1000,
    });
    const made = await createCheckout(request(100, { service, start: hour(2, 6) }));
    await pay(made.payment!);
    await assert.rejects(recordManualPayment(made.bookingId!, 3001, "cash", ""), /no more than/);
    await recordManualPayment(made.bookingId!, 1000, "cash", "");
    const link = await balancePayment(made.bookingId!);
    assert.equal(link.amountPence, 2000);
    assert.equal((await balancePayment(made.bookingId!)).id, link.id, "link is reused");
    await pay(link);
    const b = (await getBooking(made.bookingId!))!;
    assert.equal(balanceDue(b), 0);
    assert.equal(b.paidPence, 4000);
    assert.equal((await paymentsFor({ bookingId: b.id })).filter((p) => p.status === "completed").length, 3);
    // Refunding everything returns the PayPal parts and flags the cash.
    const done = await refundTarget({ bookingId: b.id }, 4000, "");
    assert.deepEqual(done, { paypalPence: 3000, manualPence: 1000 });
  });

  await check("a failed refund records nothing", async () => {
    const made = await createCheckout(request(101, { service: prepaid, start: hour(2, 7) }));
    await pay(made.payment!);
    fake.refundsFail = true;
    await assert.rejects(refundTarget({ bookingId: made.bookingId! }, 4000, ""));
    fake.refundsFail = false;
    assert.equal((await getBooking(made.bookingId!))!.refundedPence, 0);
  });

  await check("a goodwill refund does not become money owed", async () => {
    const made = await createCheckout(request(102, { service: prepaid, start: hour(4, 8) }));
    await pay(made.payment!);
    await refundTarget({ bookingId: made.bookingId! }, 500, "goodwill");
    assert.equal(balanceDue((await getBooking(made.bookingId!))!), 0);
    await assert.rejects(balancePayment(made.bookingId!), /nothing left to pay/);
  });

  console.log("Shop");
  await check("simultaneous checkouts cannot oversell one option", async () => {
    const v = await newVariant(3);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        createCheckout(request(110 + i, { items: [{ variantId: v, quantity: 1 }] })),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
    assert.equal(await stockOf(v), 0);
  });

  await check("sale prices and postcode delivery come from the database", async () => {
    const v = await newVariant(20, 2000);
    await db.update(productVariants).set({ salePricePence: 1500 }).where(eq(productVariants.id, v));
    const [{ id: method }] = await db
      .insert(deliveryMethods)
      .values({ name: `IT ${run}`, pricePence: 800, postcodes: "ZZ9", sortOrder: 999 })
      .$returningId();
    created.methods.push(method);
    const made = await createCheckout(
      request(130, { items: [{ variantId: v, quantity: 2 }], fulfilment: "delivery", deliveryMethodId: method }),
    );
    assert.equal(made.payment!.amountPence, 3000 + 800);
    const elsewhere = request(131, { items: [{ variantId: v, quantity: 1 }], fulfilment: "delivery", deliveryMethodId: method });
    elsewhere.order!.postcode = "ZZ8 1AA";
    await assert.rejects(createCheckout(elsewhere));
  });

  await check("a discount code is limited, applied once and returned if unpaid", async () => {
    const code = `IT${run}`.toUpperCase();
    const [{ id }] = await db
      .insert(discountCodes)
      .values({ code, type: "percent", value: 50, maxUses: 1 })
      .$returningId();
    created.codes.push(id);
    const uses = async () =>
      (await db.select().from(discountCodes).where(eq(discountCodes.id, id)))[0].usedCount;
    const v = await newVariant(10);
    const results = await Promise.allSettled(
      [140, 141, 142].map((n) =>
        createCheckout(request(n, { items: [{ variantId: v, quantity: 2 }], code })),
      ),
    );
    const won = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    assert.equal(won.length, 1);
    assert.equal(won[0].payment!.amountPence, 1000);
    assert.equal(await stockOf(v), 8);
    await closePayment(won[0].payment!.id, "expired");
    assert.equal(await uses(), 0);
    assert.equal(await stockOf(v), 10);
    const combinedUse = await createCheckout(
      request(143, { service: prepaid, start: hour(4, 7), items: [{ variantId: v, quantity: 1 }], code }),
    );
    assert.equal(combinedUse.payment!.amountPence, 2000 + 500);
    assert.equal(await uses(), 1);
    await cancelBooking(combinedUse.bookingId!, "customer");
    assert.equal(await uses(), 0);
  });

  await check("releasing an order twice returns stock once", async () => {
    const v = await newVariant(5);
    const made = await createCheckout(request(150, { items: [{ variantId: v, quantity: 2 }] }));
    assert.equal(await releaseOrder(made.orderId!, "expired"), true);
    assert.equal(await releaseOrder(made.orderId!, "expired"), false);
    assert.equal(await stockOf(v), 5);
  });

  await check("admin cancel restocks once", async () => {
    const v = await newVariant(5);
    const made = await createCheckout(request(151, { items: [{ variantId: v, quantity: 3 }] }));
    await pay(made.payment!);
    await cancelPaidOrder(made.orderId!, true);
    await cancelPaidOrder(made.orderId!, true);
    assert.equal(await stockOf(v), 5);
  });

  await check("one basket reminder is sent, and none after a purchase", async () => {
    const v = await newVariant(5);
    const waiting = `it-${run}-160@example.test`;
    const bought = `it-${run}-161@example.test`;
    for (const email of [waiting, bought]) {
      await saveCart({ email, name: "IT", items: [{ variantId: v, quantity: 1 }] });
    }
    await db.update(savedCarts).set({ updatedAt: new Date(Date.now() - 6 * 3_600_000) }).where(like(savedCarts.email, `it-${run}%`));
    const made = await createCheckout(request(161, { items: [{ variantId: v, quantity: 1 }] }));
    await pay(made.payment!);
    await sendCartReminders();
    await sendCartReminders();
    const sent = await db
      .select()
      .from(emailLog)
      .where(and(eq(emailLog.kind, "abandoned_cart"), like(emailLog.toAddress, `it-${run}%`)));
    assert.deepEqual(sent.map((s) => s.toAddress), [waiting]);
  });

  console.log("Private links");
  await check("only the exact signed link opens a record", async () => {
    const v = await newVariant(5);
    const a = (await getOrder((await createCheckout(request(170, { items: [{ variantId: v, quantity: 1 }] }))).orderId!))!;
    const b = (await getOrder((await createCheckout(request(171, { items: [{ variantId: v, quantity: 1 }] }))).orderId!))!;
    const token = manageToken("order", a);
    assert.equal(parseTokenId(token), a.id);
    assert.ok(verifyToken("order", token, a));
    assert.ok(!verifyToken("order", `${b.id}.${token.split(".")[1]}`, b), "signature reused");
    assert.ok(!verifyToken("payment", token, a), "order link used as a payment link");
    const swapped = token.at(-5) === "A" ? "B" : "A";
    assert.ok(!verifyToken("order", token.slice(0, -5) + swapped + token.slice(-4), a), "altered");
  });

  console.log(`\nAll ${passed} integration checks passed.`);
}

async function cleanUp() {
  const ids = (list: number[]) => (list.length ? list : [0]);
  const mine = like(orders.customerEmail, `it-${run}-%`);
  const myBookings = inArray(bookings.serviceId, ids(created.services));
  const orderRows = await db.select({ id: orders.id }).from(orders).where(mine);
  const bookingRows = await db.select({ id: bookings.id }).from(bookings).where(myBookings);
  const paymentRows = [
    ...(await db.select({ id: payments.id }).from(payments).where(inArray(payments.orderId, ids(orderRows.map((r) => r.id))))),
    ...(await db.select({ id: payments.id }).from(payments).where(inArray(payments.bookingId, ids(bookingRows.map((r) => r.id))))),
  ];
  await db.delete(refunds).where(inArray(refunds.paymentId, ids(paymentRows.map((p) => p.id))));
  await db.delete(payments).where(inArray(payments.id, ids(paymentRows.map((p) => p.id))));
  await db.delete(orders).where(mine);
  await db.delete(bookings).where(myBookings);
  await db.delete(services).where(inArray(services.id, ids(created.services)));
  await db.delete(staff).where(inArray(staff.id, ids(created.staff)));
  await db.delete(products).where(inArray(products.id, ids(created.products)));
  await db.delete(mobileAreas).where(inArray(mobileAreas.id, ids(created.areas)));
  await db.delete(discountCodes).where(inArray(discountCodes.id, ids(created.codes)));
  await db.delete(deliveryMethods).where(inArray(deliveryMethods.id, ids(created.methods)));
  await db.delete(savedCarts).where(like(savedCarts.email, `it-${run}-%`));
  if (eventIds.length) await db.delete(webhookEvents).where(inArray(webhookEvents.id, eventIds));
  await db.delete(emailLog).where(like(emailLog.toAddress, `it-${run}-%`));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await settle();
    await cleanUp();
    await closeDb();
    server.close();
    server.closeAllConnections();
  });
