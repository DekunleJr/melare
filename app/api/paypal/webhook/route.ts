import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { isPaypalConfigured, verifyWebhook } from "@/features/payments/paypal";
import { handlePaypalEvent, type PaypalEvent } from "@/features/payments/process";
import { env } from "@/lib/env";
import { TAGS } from "@/lib/tags";

export async function POST(request: Request) {
  if (!isPaypalConfigured() || !env.paypal.webhookId) {
    return new Response("PayPal is not configured", { status: 503 });
  }
  const body = await request.text();
  if (body.length > 200_000) return new Response("Too large", { status: 413 });
  let event: PaypalEvent;
  try {
    event = JSON.parse(body);
    if (!event?.id || !event.event_type || !event.resource) throw new Error("incomplete");
  } catch {
    return new Response("Invalid event", { status: 400 });
  }

  try {
    if (!(await verifyWebhook(request.headers, body))) {
      return new Response("Invalid signature", { status: 400 });
    }
    await handlePaypalEvent(event, { defer: (task) => after(task) });
  } catch (error) {
    console.error(`PayPal event ${event.id} failed`, error);
    // A non-2xx response makes PayPal retry later.
    return new Response("Processing failed", { status: 500 });
  }
  // Stock may have changed.
  revalidateTag(TAGS.products, { expire: 0 });
  return Response.json({ received: true });
}
