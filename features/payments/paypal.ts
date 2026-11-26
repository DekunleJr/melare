import "server-only";
import { env } from "@/lib/env";
import { UserError } from "@/lib/errors";
import { CURRENCY } from "@/lib/money";

// A small client for the PayPal REST API (Orders v2 and Payments v2).

export const isPaypalConfigured = () =>
  Boolean(env.paypal.clientId && env.paypal.clientSecret);

export function requirePaypal() {
  if (!isPaypalConfigured()) {
    throw new UserError("Online payment is not set up yet. Please contact the salon.");
  }
}

export class PaypalError extends Error {
  constructor(
    public status: number,
    /** PayPal's machine readable reason, e.g. INSTRUMENT_DECLINED */
    public issue: string,
    message: string,
  ) {
    super(message);
  }
}

let cached: { key: string; token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  requirePaypal();
  const { apiBase, clientId, clientSecret } = env.paypal;
  const key = `${apiBase}|${clientId}`;
  if (cached && cached.key === key && cached.expiresAt > Date.now()) return cached.token;
  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new PaypalError(response.status, "AUTHENTICATION_FAILED", "PayPal rejected the API keys.");
  }
  const data = (await response.json()) as { access_token: string; expires_in: number };
  cached = {
    key,
    token: data.access_token,
    // Renew a minute early.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  body?: string,
  requestId?: string,
): Promise<T> {
  const token = await accessToken();
  const response = await fetch(`${env.paypal.apiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      // Repeating a request with the same id never repeats its effect.
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const details = data.details as { issue?: string }[] | undefined;
    throw new PaypalError(
      response.status,
      details?.[0]?.issue ?? String(data.name ?? "UNKNOWN"),
      String(data.message ?? "PayPal request failed."),
    );
  }
  return data as T;
}

export const toValue = (pence: number) => (pence / 100).toFixed(2);
export const toPence = (value: string) => Math.round(Number(value) * 100);

export type PaypalCapture = {
  id: string;
  status: string;
  amount: { currency_code: string; value: string };
};

export type PaypalOrder = {
  id: string;
  status: string;
  payer?: { email_address?: string };
  purchase_units?: {
    custom_id?: string;
    payments?: { captures?: PaypalCapture[] };
  }[];
};

export const captureOf = (order: PaypalOrder) =>
  order.purchase_units?.[0]?.payments?.captures?.[0];

export async function createPaypalOrder(input: {
  reference: string;
  description: string;
  amountPence: number;
  brandName: string;
  /** Which button was pressed: card and wallet buttons set their own payment source */
  source: "paypal" | "other";
}) {
  const experience = {
    brand_name: input.brandName.slice(0, 127),
    shipping_preference: "NO_SHIPPING",
    user_action: "PAY_NOW",
  };
  return call<PaypalOrder>(
    "POST",
    "/v2/checkout/orders",
    JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.reference,
          custom_id: input.reference,
          description: input.description.slice(0, 127),
          amount: { currency_code: CURRENCY, value: toValue(input.amountPence) },
        },
      ],
      ...(input.source === "paypal"
        ? { payment_source: { paypal: { experience_context: experience } } }
        : { application_context: { shipping_preference: "NO_SHIPPING" } }),
    }),
  );
}

export const getPaypalOrder = (id: string) =>
  call<PaypalOrder>("GET", `/v2/checkout/orders/${encodeURIComponent(id)}`);

export const capturePaypalOrder = (id: string) =>
  call<PaypalOrder>(
    "POST",
    `/v2/checkout/orders/${encodeURIComponent(id)}/capture`,
    "{}",
    `capture-${id}`,
  );

export async function refundCapture(captureId: string, amountPence: number, requestId: string) {
  return call<{ id: string; status: string }>(
    "POST",
    `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
    JSON.stringify({ amount: { currency_code: CURRENCY, value: toValue(amountPence) } }),
    requestId,
  );
}

/** Ask PayPal whether a webhook really came from them. */
export async function verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const fields = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: env.paypal.webhookId,
  };
  if (Object.values(fields).some((v) => !v)) return false;
  // The event must be sent back byte for byte, so splice in the original text.
  const body = `${JSON.stringify(fields).slice(0, -1)},"webhook_event":${rawBody}}`;
  const result = await call<{ verification_status: string }>(
    "POST",
    "/v1/notifications/verify-webhook-signature",
    body,
  );
  return result.verification_status === "SUCCESS";
}
