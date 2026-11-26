"use client";

import { ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ActionForm, Field, Honeypot, SubmitButton, TextArea } from "@/components/ui/form";
import { EmptyState, Loading, Photo } from "@/components/ui/misc";
import {
  getCartProducts,
  rememberBasket,
  submitCheckout,
  type CartProduct,
} from "@/features/checkout/actions";
import { formatPence } from "@/lib/money";
import { cart, useCart, type CartLine } from "./cart-store";
import { DiscountField, SummaryLines, useQuote } from "./totals";

export function CartLink() {
  const { count } = useCart();
  return (
    <Link href="/cart" className="relative p-2" aria-label={`Shopping bag, ${count} items`}>
      <ShoppingBag size={20} />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-clay text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}

export function ClearCart() {
  useEffect(() => cart.clear(), []);
  return null;
}

/** Puts a saved basket (from a reminder email) back into this browser. */
export function RestoreCart({ items }: { items: CartLine[] }) {
  useEffect(() => {
    cart.replace(items);
    window.location.replace("/cart");
  }, [items]);
  return <Loading label="Restoring your bag…" />;
}

/** The bag joined with live product details from the server. */
export function useCartDetails() {
  const { items, ready } = useCart();
  const [loaded, setLoaded] = useState<{ key: string; products: CartProduct[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const key = items
    .map((l) => l.variantId)
    .sort((a, b) => a - b)
    .join(",");

  useEffect(() => {
    if (!ready || !key) return;
    let active = true;
    getCartProducts(key.split(",").map(Number))
      .then((products) => active && setLoaded({ key, products }))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [ready, key]);

  const lines = items.flatMap((line) => {
    const product = loaded?.products.find((p) => p.variantId === line.variantId);
    return product ? [{ ...line, product }] : [];
  });
  // Items that have since been withdrawn from sale
  const missing =
    loaded?.key === key ? items.filter((l) => !lines.some((x) => x.variantId === l.variantId)) : [];
  const loading = !ready || (items.length > 0 && loaded === null && !failed);
  const subtotal = lines.reduce((sum, l) => sum + l.product.pricePence * l.quantity, 0);
  return { items, lines, missing, loading, failed, subtotal };
}

function EmptyBag() {
  return (
    <EmptyState title="Your bag is empty">
      <Link href="/shop" className="btn btn-primary">
        Browse the shop
      </Link>
    </EmptyState>
  );
}

function Unavailable({ ids }: { ids: number[] }) {
  if (!ids.length) return null;
  return (
    <div role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
      Some items are no longer available.{" "}
      <button type="button" className="link" onClick={() => ids.forEach((i) => cart.remove(i))}>
        Remove them
      </button>
    </div>
  );
}

export function CartView() {
  const { items, lines, missing, loading, failed, subtotal } = useCartDetails();
  if (loading) return <Loading />;
  if (failed) return <p role="alert">We could not load your bag. Please refresh the page.</p>;
  if (!items.length) return <EmptyBag />;
  const short = lines.some((l) => l.quantity > l.product.stock);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Unavailable ids={missing.map((m) => m.variantId)} />
        {lines.map(({ product, quantity }) => (
          <div key={product.variantId} className="card flex gap-4">
            <Photo src={product.image} alt={product.name} className="size-24 shrink-0 rounded-lg" sizes="96px" />
            <div className="min-w-0 flex-1">
              <Link href={`/shop/${product.slug}`} className="font-semibold hover:underline">
                {product.name}
              </Link>
              {product.label && <p className="text-sm">{product.label}</p>}
              <p className="text-sm text-muted">{formatPence(product.pricePence)} each</p>
              {quantity > product.stock && (
                <p className="text-sm text-red-700">
                  {product.stock ? `Only ${product.stock} left.` : "Sold out."}
                </p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={quantity}
                  aria-label={`Quantity of ${product.name} ${product.label}`}
                  className="input w-20"
                  onChange={(e) => cart.setQuantity(product.variantId, Number(e.target.value) || 1)}
                />
                <button
                  type="button"
                  className="p-2 text-muted hover:text-red-700"
                  aria-label={`Remove ${product.name} ${product.label}`}
                  onClick={() => cart.remove(product.variantId)}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <p className="font-semibold">{formatPence(product.pricePence * quantity)}</p>
          </div>
        ))}
      </div>
      <aside className="card h-fit space-y-4">
        <div className="flex justify-between font-semibold">
          <span>Subtotal</span>
          <span>{formatPence(subtotal)}</span>
        </div>
        <p className="text-sm text-muted">Delivery and discount codes are applied at checkout.</p>
        {short || missing.length ? (
          <button className="btn btn-primary w-full" disabled>
            Update your bag to continue
          </button>
        ) : (
          <>
            <Link href="/checkout" className="btn btn-primary w-full">
              Checkout
            </Link>
            <Link href="/book?bag=1" prefetch={false} className="btn btn-outline w-full">
              Book an appointment with these
            </Link>
          </>
        )}
      </aside>
    </div>
  );
}

export type ContactDefaults = {
  signedIn: boolean;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
};

export function MarketingChoices({ reminder }: { reminder?: { onChange: (v: boolean) => void } }) {
  return (
    <div className="space-y-2 text-sm">
      {reminder && (
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            name="remind"
            className="mt-1 size-4 accent-clay"
            onChange={(e) => reminder.onChange(e.target.checked)}
          />
          Email me one reminder if I do not finish checking out.
        </label>
      )}
      <label className="flex items-start gap-2">
        <input type="checkbox" name="marketing" className="mt-1 size-4 accent-clay" />
        Send me news and offers by email. You can unsubscribe at any time.
      </label>
    </div>
  );
}

export function DeliveryChoice({
  options,
  selected,
  onSelect,
  postcodeEntered,
}: {
  options: { id: number; name: string; description: string; pricePence: number }[];
  selected: number | null;
  onSelect: (id: number) => void;
  postcodeEntered: boolean;
}) {
  const current = options.find((o) => o.id === selected) ?? options[0];
  return (
    <fieldset className="space-y-2">
      <legend className="label">Delivery option</legend>
      {!options.length && (
        <p className="text-sm text-muted">
          {postcodeEntered
            ? "Enter a full UK postcode to see the options for your area."
            : "Enter your postcode to see delivery options."}
        </p>
      )}
      {options.map((o) => (
        <label key={o.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line p-3 text-sm has-checked:border-clay has-checked:bg-clay/5">
          <span className="flex items-center gap-3">
            <input type="radio" className="size-4 accent-clay" checked={current?.id === o.id} onChange={() => onSelect(o.id)} />
            <span>
              <span className="font-semibold">{o.name}</span>
              {o.description && <span className="block text-muted">{o.description}</span>}
            </span>
          </span>
          <span className="font-semibold">{o.pricePence ? formatPence(o.pricePence) : "Free"}</span>
        </label>
      ))}
      <input type="hidden" name="deliveryMethodId" value={current?.id ?? 0} />
    </fieldset>
  );
}

export function CheckoutView({
  defaults,
  pickupEnabled,
}: {
  defaults: ContactDefaults;
  pickupEnabled: boolean;
}) {
  const { items, lines, missing, loading, failed } = useCartDetails();
  const [fulfilment, setFulfilment] = useState<"delivery" | "pickup">("delivery");
  const [postcode, setPostcode] = useState(defaults.postcode);
  const [method, setMethod] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [contact, setContact] = useState({
    email: defaults.customerEmail,
    name: defaults.customerName,
  });
  const [remind, setRemind] = useState(false);
  const ready = !loading && items.length > 0 && !missing.length;
  const { totals, error, loading: pricing } = useQuote(
    ready
      ? {
          order: { items, fulfilment, deliveryMethodId: method, postcode },
          discountCode: code,
        }
      : null,
  );

  const itemKey = JSON.stringify(items);
  useEffect(() => {
    if (!remind || !contact.email.includes("@") || itemKey === "[]") return;
    const timer = setTimeout(() => {
      void rememberBasket({ ...contact, items: JSON.parse(itemKey), consent: true });
    }, 800);
    return () => clearTimeout(timer);
  }, [remind, contact, itemKey]);

  if (loading) return <Loading />;
  if (failed) return <p role="alert">We could not load your bag. Please refresh the page.</p>;
  if (!items.length) return <EmptyBag />;

  return (
    <ActionForm action={submitCheckout} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Unavailable ids={missing.map((m) => m.variantId)} />
        {!defaults.signedIn && (
          <p className="rounded-lg bg-sand px-4 py-3 text-sm">
            Checking out as a guest.{" "}
            <Link href="/sign-in?next=/checkout" className="link">
              Sign in
            </Link>{" "}
            if you would like this order saved to your history.
          </p>
        )}
        <p className="text-sm">
          Having your hair done too?{" "}
          <Link href="/book?bag=1" prefetch={false} className="link">
            Book an appointment and pay for everything together
          </Link>
          .
        </p>
        <fieldset className="card grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">Your details</legend>
          <h2 className="font-display text-2xl sm:col-span-2">Your details</h2>
          <Field name="customerName" label="Full name" autoComplete="name" required defaultValue={defaults.customerName} wrapperClass="sm:col-span-2" onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} />
          <Field name="customerEmail" label="Email" type="email" autoComplete="email" required defaultValue={defaults.customerEmail} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
          <Field name="customerPhone" label="Phone" type="tel" autoComplete="tel" required defaultValue={defaults.customerPhone} />
        </fieldset>
        <fieldset className="card space-y-4">
          <legend className="sr-only">Delivery method</legend>
          <h2 className="font-display text-2xl">How would you like it?</h2>
          <div className="flex flex-wrap gap-3">
            {(pickupEnabled ? (["delivery", "pickup"] as const) : (["delivery"] as const)).map((m) => (
              <label key={m} className={`chip ${fulfilment === m ? "chip-active" : ""}`}>
                <input
                  type="radio"
                  name="fulfilment"
                  value={m}
                  checked={fulfilment === m}
                  onChange={() => setFulfilment(m)}
                  className="sr-only"
                />
                {m === "delivery" ? "Delivery" : "Collect from salon"}
              </label>
            ))}
          </div>
          {fulfilment === "delivery" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="addressLine1" label="Address" autoComplete="address-line1" required defaultValue={defaults.addressLine1} wrapperClass="sm:col-span-2" />
                <Field name="addressLine2" label="Address line 2 (optional)" autoComplete="address-line2" defaultValue={defaults.addressLine2} wrapperClass="sm:col-span-2" />
                <Field name="city" label="Town or city" autoComplete="address-level2" required defaultValue={defaults.city} />
                <Field name="postcode" label="Postcode" autoComplete="postal-code" required defaultValue={defaults.postcode} onChange={(e) => setPostcode(e.target.value)} />
              </div>
              <DeliveryChoice options={totals?.order?.deliveryOptions ?? []} selected={method} onSelect={setMethod} postcodeEntered={Boolean(postcode)} />
            </>
          )}
          <TextArea name="notes" label="Order notes (optional)" rows={2} maxLength={500} />
        </fieldset>
        <Honeypot />
        <input type="hidden" name="items" value={itemKey} />
      </div>
      <aside className="card h-fit space-y-4">
        <h2 className="font-display text-2xl">Summary</h2>
        {totals ? (
          <SummaryLines totals={totals} />
        ) : (
          <p className="text-sm text-muted">
            {lines.length} item(s). {pricing ? "Calculating…" : ""}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <DiscountField value={code} onChange={setCode} error={totals?.discountError} applied={totals?.discountCode} />
        <MarketingChoices reminder={{ onChange: setRemind }} />
        <SubmitButton className="btn btn-primary w-full" disabled={missing.length > 0 || Boolean(error) || pricing}>
          Continue to payment
        </SubmitButton>
        <p className="text-center text-xs text-muted">
          Pay securely with PayPal, debit or credit card. Apple Pay and Google Pay appear where
          available.
        </p>
      </aside>
    </ActionForm>
  );
}
