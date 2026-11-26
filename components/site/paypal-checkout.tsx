"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { confirmPayment, createPaymentOrder } from "@/features/checkout/actions";

/* The parts of PayPal's browser SDK used here. */
type Buttons = {
  render: (target: HTMLElement) => Promise<void>;
  close?: () => Promise<void>;
};
type PayPal = {
  Buttons: (options: {
    createOrder: (data: { paymentSource?: string }) => Promise<string>;
    onApprove: (data: { orderID: string }, actions: { restart: () => unknown }) => Promise<unknown>;
    onCancel: () => void;
    onError: (error: unknown) => void;
    style?: Record<string, string | number>;
  }) => Buttons;
  Googlepay?: () => {
    config: () => Promise<Record<string, unknown> & { isEligible?: boolean }>;
    confirmOrder: (input: unknown) => Promise<{ status: string }>;
    initiatePayerAction: (input: { orderId: string }) => Promise<unknown>;
  };
  Applepay?: () => {
    config: () => Promise<{
      isEligible?: boolean;
      merchantCapabilities: string[];
      supportedNetworks: string[];
    }>;
    validateMerchant: (input: { validationUrl: string }) => Promise<{ merchantSession: unknown }>;
    confirmOrder: (input: unknown) => Promise<unknown>;
  };
};
type ApplePaySessionType = {
  new (version: number, request: unknown): {
    onvalidatemerchant: (e: { validationURL: string }) => void;
    onpaymentauthorized: (e: { payment: { token: unknown; billingContact?: unknown } }) => void;
    completeMerchantValidation: (session: unknown) => void;
    completePayment: (result: { status: number }) => void;
    abort: () => void;
    begin: () => void;
  };
  supportsVersion: (v: number) => boolean;
  canMakePayments: () => boolean;
  STATUS_SUCCESS: number;
  STATUS_FAILURE: number;
};
type GooglePayments = {
  api: {
    PaymentsClient: new (options: unknown) => {
      isReadyToPay: (request: unknown) => Promise<{ result: boolean }>;
      createButton: (options: unknown) => HTMLElement;
      loadPaymentData: (request: unknown) => Promise<unknown>;
    };
  };
};
declare global {
  interface Window {
    paypal?: PayPal;
    google?: { payments?: GooglePayments };
    ApplePaySession?: ApplePaySessionType;
  }
}

const scripts = new Map<string, Promise<void>>();
function loadScript(src: string) {
  let pending = scripts.get(src);
  if (!pending) {
    pending = new Promise<void>((resolve, reject) => {
      const tag = document.createElement("script");
      tag.src = src;
      tag.async = true;
      tag.onload = () => resolve();
      tag.onerror = () => {
        scripts.delete(src);
        tag.remove();
        reject(new Error(`Could not load ${src}`));
      };
      document.head.appendChild(tag);
    });
    scripts.set(src, pending);
  }
  return pending;
}

export function PaypalCheckout({
  token,
  sdkUrl,
  clientId,
  live,
  amount,
  businessName,
}: {
  token: string;
  sdkUrl: string;
  clientId: string;
  live: boolean;
  /** Pounds, e.g. "12.50" */
  amount: string;
  businessName: string;
}) {
  const router = useRouter();
  const buttonsRef = useRef<HTMLDivElement>(null);
  const googleRef = useRef<HTMLDivElement>(null);
  const applePay = useRef<(() => void) | null>(null);
  const [showApple, setShowApple] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "working" | "pending" | "failed">(
    "loading",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    let rendered: Buttons | null = null;

    async function create(source: "paypal" | "other") {
      setMessage("");
      const result = await createPaymentOrder(token, source);
      if ("error" in result) {
        setMessage(result.error);
        throw new Error(result.error);
      }
      return result.id;
    }

    /** Ask our server to take the money. True when it succeeded or is on its way. */
    async function confirm(orderId: string): Promise<"ok" | "declined" | "failed"> {
      setState("working");
      const result = await confirmPayment(token, orderId).catch(() => "error" as const);
      if (result === "completed") {
        router.refresh();
        return "ok";
      }
      if (result === "pending") {
        setState("pending");
        router.refresh();
        return "ok";
      }
      setState("ready");
      setMessage(
        result === "declined"
          ? "That payment was declined. Please try another way to pay."
          : result === "unavailable"
            ? "This payment is no longer available. Please refresh the page."
            : "We could not confirm the payment. Refresh the page before trying again.",
      );
      return result === "declined" ? "declined" : "failed";
    }

    async function setUpGoogle(paypal: PayPal) {
      if (!paypal.Googlepay || !googleRef.current) return;
      await loadScript("https://pay.google.com/gp/p/js/pay.js");
      const api = paypal.Googlepay();
      const config = await api.config();
      const google = window.google?.payments;
      if (cancelled || !config.isEligible || !google) return;
      const base = {
        apiVersion: config.apiVersion,
        apiVersionMinor: config.apiVersionMinor,
        allowedPaymentMethods: config.allowedPaymentMethods,
      };
      const client = new google.api.PaymentsClient({
        environment: live ? "PRODUCTION" : "TEST",
        paymentDataCallbacks: {
          onPaymentAuthorized: async (data: { paymentMethodData: unknown }) => {
            try {
              const orderId = await create("other");
              const { status } = await api.confirmOrder({
                orderId,
                paymentMethodData: data.paymentMethodData,
              });
              // The bank may ask for an extra security check.
              if (status === "PAYER_ACTION_REQUIRED") await api.initiatePayerAction({ orderId });
              const outcome = await confirm(orderId);
              return { transactionState: outcome === "ok" ? "SUCCESS" : "ERROR" };
            } catch {
              return { transactionState: "ERROR" };
            }
          },
        },
      });
      if (!(await client.isReadyToPay(base)).result || cancelled) return;
      googleRef.current.replaceChildren(
        client.createButton({
          allowedPaymentMethods: base.allowedPaymentMethods,
          buttonSizeMode: "fill",
          onClick: () =>
            client
              .loadPaymentData({
                ...base,
                merchantInfo: config.merchantInfo,
                transactionInfo: {
                  countryCode: "GB",
                  currencyCode: "GBP",
                  totalPriceStatus: "FINAL",
                  totalPrice: amount,
                },
                callbackIntents: ["PAYMENT_AUTHORIZATION"],
              })
              // Closing the wallet is not an error worth showing.
              .catch(() => {}),
        }),
      );
    }

    async function setUpApple(paypal: PayPal) {
      const Session = window.ApplePaySession;
      if (!paypal.Applepay || !Session?.supportsVersion(4) || !Session.canMakePayments()) return;
      const api = paypal.Applepay();
      const config = await api.config();
      if (cancelled || !config.isEligible) return;
      applePay.current = () => {
        const session = new Session(4, {
          countryCode: "GB",
          currencyCode: "GBP",
          merchantCapabilities: config.merchantCapabilities,
          supportedNetworks: config.supportedNetworks,
          requiredBillingContactFields: ["postalAddress"],
          total: { label: businessName, amount, type: "final" },
        });
        session.onvalidatemerchant = (event) => {
          api
            .validateMerchant({ validationUrl: event.validationURL })
            .then((r) => session.completeMerchantValidation(r.merchantSession))
            .catch(() => session.abort());
        };
        session.onpaymentauthorized = async (event) => {
          try {
            const orderId = await create("other");
            await api.confirmOrder({
              orderId,
              token: event.payment.token,
              billingContact: event.payment.billingContact,
            });
            const outcome = await confirm(orderId);
            session.completePayment({
              status: outcome === "ok" ? Session.STATUS_SUCCESS : Session.STATUS_FAILURE,
            });
          } catch {
            session.completePayment({ status: Session.STATUS_FAILURE });
          }
        };
        session.begin();
      };
      setShowApple(true);
    }

    async function start() {
      const query = new URLSearchParams({
        "client-id": clientId,
        currency: "GBP",
        intent: "capture",
        components: "buttons,googlepay,applepay",
      });
      await loadScript(`${sdkUrl}?${query}`);
      const paypal = window.paypal;
      if (cancelled || !paypal || !buttonsRef.current) return;
      buttonsRef.current.replaceChildren();
      rendered = paypal.Buttons({
        style: { layout: "vertical", shape: "pill" },
        createOrder: (data) => create(data.paymentSource === "paypal" ? "paypal" : "other"),
        onApprove: async (data, actions) => {
          if ((await confirm(data.orderID)) === "declined") return actions.restart();
        },
        onCancel: () => setMessage("Payment cancelled. Nothing has been charged."),
        onError: (error) => {
          console.error(error);
          setMessage((m) => m || "Something went wrong with PayPal. Please try again.");
        },
      });
      await rendered.render(buttonsRef.current);
      if (cancelled) return;
      setState("ready");
      // Wallets are extras: if they cannot load, the main buttons still work.
      setUpGoogle(paypal).catch((e) => console.warn("Google Pay unavailable", e));
      if (window.ApplePaySession) {
        setUpApple(paypal).catch((e) => console.warn("Apple Pay unavailable", e));
      }
    }

    start().catch((error) => {
      console.error(error);
      if (!cancelled) setState("failed");
    });
    return () => {
      cancelled = true;
      rendered?.close?.().catch(() => {});
    };
  }, [token, sdkUrl, clientId, live, amount, businessName, router]);

  return (
    <div className="space-y-3">
      {state === "loading" && <p role="status">Loading secure payment…</p>}
      {state === "working" && <p role="status">Confirming your payment…</p>}
      {state === "pending" && <p role="status">Your payment is being checked by PayPal.</p>}
      {state === "failed" && (
        <p role="alert" className="text-red-700">
          We could not load PayPal. Check your connection or content blocker and refresh the page.
        </p>
      )}
      {message && (
        <p role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {message}
        </p>
      )}
      <div className={state === "working" || state === "pending" ? "hidden" : "space-y-3"}>
        {showApple && (
          <button
            type="button"
            onClick={() => applePay.current?.()}
            className="h-12 w-full cursor-pointer rounded-full bg-black text-white"
          >
            Pay with Apple Pay
          </button>
        )}
        <div ref={googleRef} className="*:w-full" />
        <div ref={buttonsRef} />
      </div>
    </div>
  );
}
