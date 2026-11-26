import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingAddons, bookings, contactMessages, orders } from "@/db/schema";
import { getBooking } from "@/features/bookings/service";
import { getOrder } from "@/features/orders/service";
import { balanceDue, getPayment } from "@/features/payments/ledger";
import { sendEmail } from "@/lib/email/send";
import { buildIcs, renderEmail, type EmailContent } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { label } from "@/lib/labels";
import { formatPence } from "@/lib/money";
import { notificationRecipient, readSettings, type Settings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { manageUrl } from "@/lib/tokens";

type Booking = NonNullable<Awaited<ReturnType<typeof getBooking>>>;
type Order = NonNullable<Awaited<ReturnType<typeof getOrder>>>;
type Content = Omit<EmailContent, "businessName">;
type Rows = [string, string][];

function compose(s: Settings, content: Content) {
  return renderEmail({ businessName: s.businessName, ...content });
}

async function toCustomer(
  s: Settings,
  to: string,
  kind: string,
  subject: string,
  content: Content,
  ics?: string,
) {
  await sendEmail({
    to,
    kind,
    subject,
    ics,
    replyTo: notificationRecipient(s) || undefined,
    ...compose(s, content),
  });
}

async function toSalon(
  s: Settings,
  kind: string,
  subject: string,
  content: Content,
  replyTo?: string,
) {
  const to = notificationRecipient(s);
  if (!to) {
    console.warn(`No contact email set, so "${kind}" was not sent. Set it in Admin > Settings.`);
    return;
  }
  await sendEmail({ to, kind, subject, replyTo, ...compose(s, content) });
}

const adminLink = (path: string) => ({ label: "Open in admin", url: `${env.siteUrl}${path}` });
const address = (r: { addressLine1: string; addressLine2: string; city: string; postcode: string }) =>
  [r.addressLine1, r.addressLine2, r.city, r.postcode].filter(Boolean).join("\n");

// ---------- Orders ----------

function itemRows(o: Order): Rows {
  return o.items.map((i) => [
    `${i.quantity} × ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""}`,
    formatPence(i.unitPricePence * i.quantity),
  ]);
}

const handover = (o: Order) =>
  o.fulfilment === "delivery"
    ? address(o)
    : o.fulfilment === "pickup"
      ? "Collect from the salon"
      : "At your appointment";

function orderRows(o: Order): Rows {
  const rows = itemRows(o);
  if (o.fulfilment === "delivery") {
    rows.push([o.deliveryMethodName || "Delivery", formatPence(o.deliveryPence)]);
  }
  if (o.discountPence) {
    rows.push([`Discount ${o.discountCode}`.trim(), `-${formatPence(o.discountPence)}`]);
  }
  rows.push(["Products total", formatPence(o.totalPence)]);
  rows.push([o.fulfilment === "delivery" ? "Deliver to" : "Collection", handover(o)]);
  return rows;
}

const contactRows = (r: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
}): Rows => [
  ["Customer", r.customerName],
  ["Email", r.customerEmail],
  ["Phone", r.customerPhone],
  ...(r.notes ? ([["Notes", r.notes]] as Rows) : []),
];

export async function notifyOrder(id: number, event: "paid" | "status" | "refund") {
  const order = await getOrder(id);
  if (!order) return;
  const s = await readSettings();
  const manage = { label: "View your order", url: manageUrl("order", order) };

  if (event === "paid") {
    await toCustomer(s, order.customerEmail, "order_receipt", `Order ${order.number} confirmed`, {
      heading: "Thank you for your order",
      paragraphs: [
        `Hello ${order.customerName},`,
        order.fulfilment === "pickup"
          ? s.pickupInstructions
          : order.fulfilment === "delivery"
            ? "We will email you when your order is on its way."
            : "Your products will be ready at your appointment.",
        "This email is your receipt.",
      ],
      details: [["Order", order.number], ...orderRows(order)],
      button: manage,
    });
    await toSalon(
      s,
      "salon_order",
      `New order ${order.number}: ${formatPence(order.totalPence)}`,
      {
        heading: "New product order",
        details: [["Order", order.number], ...orderRows(order), ...contactRows(order)],
        button: adminLink(`/admin/orders/${order.id}`),
      },
      order.customerEmail,
    );
    return;
  }

  if (event === "refund") {
    const heading = "Your order refund";
    await toCustomer(s, order.customerEmail, "order_refund", `${heading}: ${order.number}`, {
      heading,
      paragraphs: [
        `Hello ${order.customerName},`,
        "We have refunded the amount below. It usually arrives within 5 to 10 working days.",
      ],
      details: [
        ["Order", order.number],
        ["Total refunded", formatPence(order.refundedPence)],
      ],
      button: manage,
    });
    await toSalon(s, "salon_order_refund", `Order ${order.number} refunded`, {
      heading: "Order refunded",
      details: [
        ["Order", order.number],
        ["Customer", order.customerName],
        ["Total refunded", formatPence(order.refundedPence)],
      ],
    });
    return;
  }

  const status = label(order.status);
  await toCustomer(
    s,
    order.customerEmail,
    order.status === "shipped" ? "order_dispatched" : "order_status",
    `Order ${order.number}: ${status}`,
    {
      heading:
        order.status === "shipped" ? "Your order has been dispatched" : `Your order is now: ${status}`,
      paragraphs: [
        `Hello ${order.customerName},`,
        order.status === "ready_for_pickup" ? s.pickupInstructions : "",
      ].filter(Boolean),
      details: [
        ["Order", order.number],
        ...(order.trackingInfo ? ([["Tracking", order.trackingInfo]] as Rows) : []),
      ],
      button: manage,
    },
  );
}

// ---------- Bookings ----------

async function bookingRows(b: Booking): Promise<Rows> {
  const addons = await db
    .select()
    .from(bookingAddons)
    .where(eq(bookingAddons.bookingId, b.id))
    .orderBy(asc(bookingAddons.id));
  const rows: Rows = [
    ["Reference", b.reference],
    ["Service", b.serviceName],
    ["With", b.staffName],
    ["When", formatDateTime(b.startsAt)],
    ["Where", b.locationType === "mobile" ? address(b) : "At the salon"],
  ];
  for (const a of addons) rows.push([`Extra: ${a.name}`, formatPence(a.pricePence)]);
  if (b.travelFeePence) rows.push(["Travel fee", formatPence(b.travelFeePence)]);
  if (b.discountPence) {
    rows.push([`Discount ${b.discountCode}`.trim(), `-${formatPence(b.discountPence)}`]);
  }
  rows.push(["Appointment total", formatPence(b.totalPence)]);
  if (b.paidPence) rows.push(["Paid", formatPence(b.paidPence)]);
  if (b.refundedPence) rows.push(["Refunded", formatPence(b.refundedPence)]);
  const owed = balanceDue(b);
  if (owed) rows.push(["Still to pay", formatPence(owed)]);
  return rows;
}

const invite = (s: Settings, b: Booking) =>
  buildIcs({
    uid: `${b.reference}@melarebeauty`,
    start: b.startsAt,
    end: b.endsAt,
    summary: `${b.serviceName} at ${s.businessName}`,
    location: b.locationType === "mobile" ? address(b).replace(/\n/g, ", ") : s.address || undefined,
  });

async function linkedOrder(bookingId: number) {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.bookingId, bookingId));
  return row ? getOrder(row.id) : undefined;
}

export type BookingEvent =
  | "requested"
  | "approved"
  | "declined"
  | "request_expired"
  | "confirmed"
  | "rescheduled"
  | "cancelled"
  | "slot_lost"
  | "reminder";

export async function notifyBooking(
  id: number,
  event: BookingEvent,
  extra: { payUrl?: string; payBy?: Date } = {},
) {
  const booking = await getBooking(id);
  if (!booking) return;
  const s = await readSettings();
  const order = await linkedOrder(id);
  const manage = { label: "View or change booking", url: manageUrl("booking", booking) };

  const refunded = booking.refundedPence
    ? "Your refund is on its way and usually arrives within 5 to 10 working days."
    : "We hope to see you another time.";
  const copy: Record<BookingEvent, { customer: [string, string]; salon: string | null }> = {
    requested: {
      customer: [
        "We have your booking request",
        "We will check it and email you. You do not need to pay anything yet.",
      ],
      salon: "Booking request waiting for approval",
    },
    approved: {
      customer: [
        "Your request is approved: please pay to confirm",
        `Pay by ${extra.payBy ? formatDateTime(extra.payBy) : "the deadline"} to keep your time.`,
      ],
      salon: null,
    },
    declined: {
      customer: [
        "We cannot accept your booking request",
        "Nothing has been charged. Please choose another time or contact us.",
      ],
      salon: null,
    },
    request_expired: {
      customer: [
        "Your booking request has expired",
        "Nothing has been charged. Please send a new request or contact us.",
      ],
      salon: "Booking request expired without a decision",
    },
    confirmed: {
      customer: ["Your booking is confirmed", "We look forward to seeing you."],
      salon: "New booking",
    },
    rescheduled: {
      customer: ["Your booking has moved", "Here is your new appointment time."],
      salon: "Booking rescheduled",
    },
    cancelled: { customer: ["Your booking is cancelled", refunded], salon: "Booking cancelled" },
    slot_lost: {
      customer: [
        "We could not confirm your booking",
        "Your payment arrived after the time was no longer available, so we are refunding it. Please choose another time.",
      ],
      salon: "Booking could not be confirmed (payment refunded)",
    },
    reminder: {
      customer: ["Appointment reminder", "This is a friendly reminder of your appointment."],
      salon: null,
    },
  };

  const { customer, salon } = copy[event];
  const [heading, message] = customer;
  const showProducts =
    order && ["requested", "approved", "confirmed"].includes(event)
      ? ([...itemRows(order), ["Products total", formatPence(order.totalPence)]] as Rows)
      : [];
  const rows = [...(await bookingRows(booking)), ...showProducts];

  await toCustomer(
    s,
    booking.customerEmail,
    `booking_${event}`,
    `${heading}: ${booking.serviceName}, ${formatDateTime(booking.startsAt)}`,
    {
      heading,
      paragraphs: [`Hello ${booking.customerName},`, message],
      details: rows,
      button: extra.payUrl ? { label: "Pay now", url: extra.payUrl } : manage,
      footer: [
        extra.payUrl ? `View your booking: ${manage.url}` : "",
        s.cancellationPolicy,
        s.address,
        s.phone,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    event === "confirmed" || event === "rescheduled" ? invite(s, booking) : undefined,
  );

  if (salon) {
    await toSalon(
      s,
      `salon_booking_${event}`,
      `${salon}: ${booking.serviceName}, ${formatDateTime(booking.startsAt)}`,
      {
        heading: salon,
        details: [...rows, ...contactRows(booking)],
        button: adminLink(`/admin/bookings/${booking.id}`),
      },
      booking.customerEmail,
    );
  }
}

/** Marks first so overlapping runs cannot send twice. */
export async function sendReminder(id: number) {
  await db.update(bookings).set({ reminderSentAt: new Date() }).where(eq(bookings.id, id));
  await notifyBooking(id, "reminder");
}

// ---------- Payments ----------

/** The right confirmation for whatever a payment covered. */
export async function notifyPayment(paymentId: number) {
  const payment = await getPayment(paymentId);
  if (!payment) return;
  if (payment.purpose === "checkout") {
    if (payment.bookingId) await notifyBooking(payment.bookingId, "confirmed");
    // A combined purchase also gets a product receipt.
    if (payment.orderId) await notifyOrder(payment.orderId, "paid");
    return;
  }
  const booking = payment.bookingId ? await getBooking(payment.bookingId) : undefined;
  if (!booking) return;
  const s = await readSettings();
  await toCustomer(s, booking.customerEmail, "payment_receipt", `Payment receipt ${payment.reference}`, {
    heading: "Payment received",
    paragraphs: [`Hello ${booking.customerName},`, "Thank you. This email is your receipt."],
    details: [
      ["Receipt", payment.reference],
      ["Amount", formatPence(payment.amountPence)],
      ["Paid by", label(payment.method)],
      ...(await bookingRows(booking)),
    ],
    button: { label: "View booking", url: manageUrl("booking", booking) },
  });
  await toSalon(s, "salon_payment", `Balance paid for ${booking.reference}`, {
    heading: "Balance payment received",
    details: [
      ["Booking", booking.reference],
      ["Customer", booking.customerName],
      ["Amount", formatPence(payment.amountPence)],
    ],
    button: adminLink(`/admin/bookings/${booking.id}`),
  });
}

export async function notifyBalanceRequest(paymentId: number) {
  const payment = await getPayment(paymentId);
  const booking = payment?.bookingId ? await getBooking(payment.bookingId) : undefined;
  if (!payment || !booking) return;
  const s = await readSettings();
  await toCustomer(s, booking.customerEmail, "payment_request", `Payment request for ${booking.reference}`, {
    heading: "Pay your remaining balance",
    paragraphs: [`Hello ${booking.customerName},`],
    details: [
      ["Booking", booking.reference],
      ["Service", booking.serviceName],
      ["When", formatDateTime(booking.startsAt)],
      ["Amount", formatPence(payment.amountPence)],
    ],
    button: { label: "Pay now", url: manageUrl("payment", payment) },
  });
}

/** Money that should go back could not be returned automatically. */
export async function notifyRefundNeeded(paymentId: number) {
  const payment = await getPayment(paymentId);
  if (!payment) return;
  const s = await readSettings();
  await toSalon(s, "salon_refund_needed", `Action needed: refund payment ${payment.reference}`, {
    heading: "A refund needs your attention",
    paragraphs: [
      "A payment arrived for something that is no longer available, and the automatic refund failed. Please refund it.",
    ],
    details: [
      ["Payment", payment.reference],
      ["Amount", formatPence(payment.amountPence)],
    ],
    button: adminLink(`/admin/payments`),
  });
}

// ---------- Accounts, baskets, contact ----------

export async function notifyWelcome(to: string, name: string) {
  const s = await readSettings();
  await toCustomer(s, to, "welcome", `Welcome to ${s.businessName}`, {
    heading: "Your account is ready",
    paragraphs: [
      `Hello ${name},`,
      "You can now see your orders and appointments, pay balances and check out faster.",
    ],
    button: { label: "Open your account", url: `${env.siteUrl}/account` },
    footer: "If you did not create this account, please contact us.",
  });
}

export async function notifyAbandonedCart(
  cart: { id: number; email: string; name: string; tokenNonce: string },
  lines: Rows,
) {
  const s = await readSettings();
  await toCustomer(s, cart.email, "abandoned_cart", "You left something in your bag", {
    heading: "Your bag is waiting",
    paragraphs: [
      cart.name ? `Hello ${cart.name},` : "Hello,",
      "You asked us to remind you if you did not finish checking out.",
    ],
    details: lines,
    button: { label: "Return to your bag", url: manageUrl("cart", cart) },
    footer: "This is the only reminder we will send for this bag.",
  });
}

export async function notifyContactMessage(id: number) {
  const [m] = await db.select().from(contactMessages).where(eq(contactMessages.id, id));
  if (!m) return;
  const s = await readSettings();
  await toSalon(
    s,
    "salon_contact",
    `Website message: ${m.subject}`,
    {
      heading: "New message from your website",
      paragraphs: [m.message],
      details: [
        ["Name", m.name],
        ["Email", m.email],
        ...(m.phone ? ([["Phone", m.phone]] as Rows) : []),
      ],
    },
    m.email,
  );
}
