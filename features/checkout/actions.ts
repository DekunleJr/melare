"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidateTag, updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { productImages, productVariants, products } from "@/db/schema";
import { accessPayment } from "@/features/access";
import { forgetCart, saveCart } from "@/features/carts";
import { addSubscriber } from "@/features/marketing";
import { notifyBooking, notifyOrder } from "@/features/notifications";
import { isPaypalConfigured, requirePaypal } from "@/features/payments/paypal";
import {
  capturePayment,
  releaseStale,
  startPayment,
  type CaptureResult,
} from "@/features/payments/process";
import { variantLabel, variantPrice } from "@/features/pricing";
import { formObject, runAction } from "@/lib/actions";
import { UserError } from "@/lib/errors";
import type { FormState } from "@/lib/forms";
import { allowRequest } from "@/lib/rate-limit";
import { getOptionalUser } from "@/lib/session";
import { deletePrivateImage, savePrivateImage } from "@/lib/storage";
import { TAGS } from "@/lib/tags";
import { manageToken } from "@/lib/tokens";
import { checkbox, contactDetails, email, optionalText } from "@/lib/validation";
import { createCheckout, quote, type CheckoutRequest } from "./service";

const idNumber = z.number().int().positive();
const lines = z
  .array(z.object({ variantId: idNumber, quantity: z.number().int().min(1).max(20) }))
  .max(30);

/** Fresh names, prices and stock for the options in a browser's bag. */
export async function getCartProducts(variantIds: number[]) {
  const parsed = z.array(idNumber).max(60).safeParse(variantIds);
  if (!parsed.success || !parsed.data.length) return [];
  const rows = await db
    .select({ variant: productVariants, product: products })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        inArray(productVariants.id, parsed.data),
        eq(productVariants.active, true),
        eq(products.status, "active"),
      ),
    );
  const images = rows.length
    ? await db
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, rows.map((r) => r.product.id)))
        .orderBy(productImages.sortOrder, productImages.id)
    : [];
  return rows.map(({ variant, product }) => ({
    variantId: variant.id,
    name: product.name,
    label: variantLabel(variant),
    slug: product.slug,
    pricePence: variantPrice(variant),
    stock: variant.stock,
    image: variant.imagePath ?? images.find((i) => i.productId === product.id)?.path ?? null,
  }));
}

export type CartProduct = Awaited<ReturnType<typeof getCartProducts>>[number];

// ---------- Live price preview ----------

const quoteInput = z.object({
  booking: z
    .object({
      serviceId: idNumber,
      locationType: z.enum(["salon", "mobile"]),
      postcode: z.string().max(20),
      addonIds: z.array(idNumber).max(30),
    })
    .optional(),
  order: z
    .object({
      items: lines.min(1),
      fulfilment: z.enum(["delivery", "pickup", "appointment"]),
      deliveryMethodId: idNumber.nullable(),
      postcode: z.string().max(20),
    })
    .optional(),
  discountCode: z.string().max(40),
});

export type QuoteInput = z.input<typeof quoteInput>;

/** The authoritative order summary shown before anyone pays. */
export async function previewTotals(input: QuoteInput) {
  const parsed = quoteInput.safeParse(input);
  if (!parsed.success) return { error: "Please check your selections." };
  if (!(await allowRequest("quote", 200, 5))) return { error: "Please wait a moment." };
  try {
    const result = await quote(parsed.data);
    const { booking, order } = result;
    return {
      booking: booking && {
        name: booking.service.name,
        pricePence: booking.service.pricePence,
        addons: booking.addons.map((a) => ({ name: a.name, pricePence: a.pricePence })),
        travelFeePence: booking.travelFeePence,
        durationMinutes: booking.durationMinutes,
        discountPence: booking.discountPence,
        totalPence: booking.totalPence,
        duePence: booking.duePence,
        needsApproval: booking.needsApproval,
      },
      order: order && {
        lines: order.lines.map((l) => ({
          name: l.variantLabel ? `${l.name} (${l.variantLabel})` : l.name,
          quantity: l.quantity,
          totalPence: l.unitPricePence * l.quantity,
        })),
        deliveryOptions: order.deliveryOptions,
        deliveryPence: order.deliveryPence,
        discountPence: order.discountPence,
        totalPence: order.totalPence,
      },
      discountCode: result.discount?.code ?? "",
      discountError: result.discountError,
      totalPence: result.totalPence,
      dueNowPence: result.dueNowPence,
    };
  } catch (error) {
    if (error instanceof UserError) return { error: error.message };
    console.error(error);
    return { error: "We could not work out the total. Please try again." };
  }
}

export type Totals = Exclude<Awaited<ReturnType<typeof previewTotals>>, { error: string }>;

// ---------- Placing the order or booking ----------

const json = <T>(schema: z.ZodType<T>) =>
  z.string().transform((value, ctx) => {
    try {
      return schema.parse(JSON.parse(value || "[]"));
    } catch {
      ctx.addIssue({ code: "custom", message: "Your selections are invalid. Please reload." });
      return z.NEVER;
    }
  });

const address = {
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(100),
  postcode: optionalText(20),
};

const checkoutSchema = z.object({
  ...contactDetails,
  ...address,
  discountCode: optionalText(40),
  notes: optionalText(500),
  items: json(lines).optional(),
  fulfilment: z.enum(["delivery", "pickup", "appointment"]).optional(),
  deliveryMethodId: z.coerce.number().int().min(0).default(0),
  // Appointment fields
  serviceId: z.coerce.number().int().positive().optional(),
  staffId: z.coerce.number().int().min(0).default(0),
  start: z
    .iso.datetime({ error: "Choose a time." })
    .transform((v) => new Date(v))
    .optional(),
  locationType: z.enum(["salon", "mobile"]).default("salon"),
  addonIds: json(z.array(idNumber).max(30)).optional(),
  marketing: checkbox,
  remind: checkbox,
});

const MAX_PHOTOS = 3;

/** One submission for products, an appointment, or both together. */
export async function submitCheckout(_: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    if (formData.get("website")) throw new UserError("Your request could not be submitted.");
    if (!(await allowRequest("checkout", 10, 10))) {
      throw new UserError("Too many attempts. Please wait a few minutes.");
    }
    const data = checkoutSchema.parse(formObject(formData));
    const items = data.items ?? [];
    const hasBooking = data.serviceId !== undefined;
    if (!hasBooking && !items.length) throw new UserError("Your bag is empty.");
    if (hasBooking && !data.start) throw new UserError("Choose a date and time.");

    const fulfilment = data.fulfilment ?? "delivery";
    const mobile = hasBooking && data.locationType === "mobile";
    const needsAddress = mobile || (items.length > 0 && fulfilment === "delivery");
    if (needsAddress) {
      const errors: Record<string, string> = {};
      for (const field of ["addressLine1", "city", "postcode"] as const) {
        if (!data[field]) errors[field] = "Required.";
      }
      if (Object.keys(errors).length) {
        return { message: "Please complete the address.", errors };
      }
    }

    // The account is taken from the session, never from the form.
    const user = await getOptionalUser();
    const place = {
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      postcode: data.postcode,
    };
    const request: CheckoutRequest = {
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      discountCode: data.discountCode,
      userId: user?.id ?? null,
      source: "online",
      order: items.length
        ? {
            items,
            fulfilment,
            deliveryMethodId: data.deliveryMethodId || null,
            notes: data.notes,
            ...place,
          }
        : undefined,
      booking: hasBooking
        ? {
            serviceId: data.serviceId!,
            staffId: data.staffId || null,
            start: data.start!,
            locationType: data.locationType,
            addonIds: data.addonIds ?? [],
            notes: data.notes,
            images: [],
            ...place,
          }
        : undefined,
    };

    // Fail early, before holding anything, if payment is needed but not set up.
    const priced = await quote(
      { booking: request.booking, order: request.order, discountCode: data.discountCode },
      true,
    );
    if (priced.dueNowPence > 0 && !isPaypalConfigured()) requirePaypal();

    after(async () => {
      if (await releaseStale({ defer: (task) => after(task) })) {
        revalidateTag(TAGS.products, { expire: 0 });
      }
    });

    const photos: string[] = [];
    let result;
    try {
      if (request.booking) {
        const files = formData.getAll("photos").filter((f) => f instanceof File && f.size > 0);
        if (files.length > MAX_PHOTOS) throw new UserError(`Add up to ${MAX_PHOTOS} photos.`);
        for (const file of files) {
          const name = await savePrivateImage(file);
          if (name) photos.push(name);
        }
        request.booking.images = photos;
      }
      result = await createCheckout(request);
    } catch (error) {
      await Promise.all(photos.map(deletePrivateImage));
      throw error;
    }

    if (items.length) updateTag(TAGS.products);
    if (data.marketing) await addSubscriber(data.customerEmail);
    if (items.length) {
      if (data.remind && result.payment) {
        await saveCart({ email: data.customerEmail, name: data.customerName, items });
      } else await forgetCart(data.customerEmail);
    }

    // Tells the confirmation page that the bag has been used.
    const bag = items.length ? "?bag=used" : "";
    if (result.payment) {
      return { url: `/pay/${manageToken("payment", result.payment)}${bag}` };
    }
    const { bookingId, orderId, needsApproval } = result;
    if (bookingId) {
      after(() => notifyBooking(bookingId, needsApproval ? "requested" : "confirmed"));
    }
    if (orderId && !needsApproval) after(() => notifyOrder(orderId, "paid"));
    const { getBooking } = await import("@/features/bookings/service");
    const { getOrder } = await import("@/features/orders/service");
    const record = bookingId ? await getBooking(bookingId) : await getOrder(orderId!);
    const kind = bookingId ? "booking" : "order";
    return { url: `/manage/${kind}/${manageToken(kind, record!)}?new=1${bag && "&bag=used"}` };
  });
}

/** Remember a basket for someone who asked for a reminder. */
export async function rememberBasket(input: {
  email: string;
  name: string;
  items: { variantId: number; quantity: number }[];
  consent: boolean;
}) {
  const parsed = z
    .object({ email, name: z.string().max(120), items: lines.min(1), consent: z.boolean() })
    .safeParse(input);
  if (!parsed.success || !(await allowRequest("basket", 30, 10))) return;
  if (parsed.data.consent) await saveCart(parsed.data);
}

// ---------- Paying ----------

export async function createPaymentOrder(
  token: string,
  source: "paypal" | "other",
): Promise<{ id: string } | { error: string }> {
  if (!(await allowRequest("pay", 40, 10))) return { error: "Please wait a few minutes." };
  const payment = await accessPayment(token);
  if (!payment) return { error: "This payment link is not valid." };
  try {
    return { id: await startPayment(payment.id, source === "paypal" ? "paypal" : "other") };
  } catch (error) {
    if (error instanceof UserError) return { error: error.message };
    console.error("Could not create the PayPal order", error);
    return { error: "We could not connect to PayPal. Please try again." };
  }
}

export async function confirmPayment(
  token: string,
  paypalOrderId: string,
): Promise<CaptureResult | "error"> {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(paypalOrderId)) return "error";
  const payment = await accessPayment(token);
  if (!payment) return "unavailable";
  try {
    const result = await capturePayment(payment.id, paypalOrderId, {
      defer: (task) => after(task),
    });
    if (result === "completed") {
      await forgetCartFor(payment.orderId);
      updateTag(TAGS.products);
    }
    return result;
  } catch (error) {
    console.error("Could not capture the payment", error);
    return "error";
  }
}

async function forgetCartFor(orderId: number | null) {
  if (!orderId) return;
  const { getOrder } = await import("@/features/orders/service");
  const order = await getOrder(orderId);
  if (order) await forgetCart(order.customerEmail);
}
