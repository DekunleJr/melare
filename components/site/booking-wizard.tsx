"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ActionForm, Field, Honeypot, SubmitButton, TextArea } from "@/components/ui/form";
import { fetchSlots } from "@/features/bookings/actions";
import { submitCheckout } from "@/features/checkout/actions";
import { formatPence } from "@/lib/money";
import { matchPostcode, normalisePostcode } from "@/lib/postcode";
import { formatDateTime, formatDuration } from "@/lib/time";
import { DeliveryChoice, MarketingChoices, type ContactDefaults } from "./cart-ui";
import { useCart, type CartLine } from "./cart-store";
import { SlotPicker } from "./slot-picker";
import { DiscountField, SummaryLines, useQuote } from "./totals";

export type BookableService = {
  id: number;
  name: string;
  category: string;
  durationMinutes: number;
  pricePence: number;
  locationMode: "salon" | "mobile" | "both";
  requiresApproval: boolean;
  suggestedCategoryId: number | null;
  addons: { id: number; name: string; pricePence: number; extraMinutes: number }[];
  staff: { id: number; name: string; title: string; offersMobile: boolean }[];
};

export type BookingProduct = {
  id: number;
  name: string;
  categoryId: number | null;
  categoryName: string;
  variants: { id: number; label: string; pricePence: number; stock: number }[];
};

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2 className="mb-4 flex items-center gap-3 font-display text-2xl">
        <span className="grid size-8 place-items-center rounded-full bg-sand font-sans text-sm font-semibold">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ProductPicker({
  products,
  suggested,
  chosen,
  onChange,
}: {
  products: BookingProduct[];
  suggested: number | null;
  chosen: CartLine[];
  onChange: (lines: CartLine[]) => void;
}) {
  const [category, setCategory] = useState<number | "all">(suggested ?? "all");
  const [productId, setProductId] = useState(0);
  const [variantId, setVariantId] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const categories = [
    ...new Map(
      products.filter((p) => p.categoryId).map((p) => [p.categoryId!, p.categoryName]),
    ),
  ];
  const shown = products.filter((p) => category === "all" || p.categoryId === category);
  const product = shown.find((p) => p.id === productId);
  const variant =
    product?.variants.find((v) => v.id === variantId) ??
    (product?.variants.length === 1 ? product.variants[0] : undefined);
  const find = (id: number) => {
    for (const p of products) {
      const v = p.variants.find((x) => x.id === id);
      if (v) return { p, v };
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="picker-category">Category</label>
          <select
            id="picker-category"
            className="input"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value === "all" ? "all" : Number(e.target.value));
              setProductId(0);
            }}
          >
            <option value="all">All products</option>
            {categories.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="picker-product">Product</label>
          <select
            id="picker-product"
            className="input"
            value={productId}
            onChange={(e) => {
              setProductId(Number(e.target.value));
              setVariantId(0);
              setQuantity(1);
            }}
          >
            <option value={0}>Choose a product…</option>
            {shown.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {product && (
        <div className="flex flex-wrap items-end gap-3">
          {product.variants.length > 1 && (
            <div className="min-w-48 flex-1">
              <label className="label" htmlFor="picker-option">Option (colour, length, size)</label>
              <select id="picker-option" className="input" value={variantId} onChange={(e) => setVariantId(Number(e.target.value))}>
                <option value={0}>Choose an option…</option>
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.stock < 1}>
                    {v.label || "Standard"} · {formatPence(v.pricePence)}
                    {v.stock < 1 ? " · sold out" : ` · ${v.stock} in stock`}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor="picker-quantity">Quantity</label>
            <input id="picker-quantity" type="number" min={1} max={Math.min(20, variant?.stock || 1)} value={quantity} className="input w-24" onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <button
            type="button"
            className="btn btn-outline"
            disabled={!variant || variant.stock < quantity}
            onClick={() => {
              const rest = chosen.filter((l) => l.variantId !== variant!.id);
              onChange([...rest, { variantId: variant!.id, quantity: Math.min(20, quantity) }]);
              setProductId(0);
            }}
          >
            <Plus size={16} /> Add product
          </button>
          {variant && variant.stock < quantity && (
            <p className="w-full text-sm text-red-700">
              {variant.stock ? `Only ${variant.stock} in stock.` : "Sold out."}
            </p>
          )}
        </div>
      )}
      {chosen.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {chosen.map((line) => {
            const found = find(line.variantId);
            if (!found) return null;
            return (
              <li key={line.variantId} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span>
                  {line.quantity} × {found.p.name}
                  {found.v.label && ` (${found.v.label})`}
                </span>
                <span className="flex items-center gap-3">
                  {formatPence(found.v.pricePence * line.quantity)}
                  <button
                    type="button"
                    aria-label={`Remove ${found.p.name}`}
                    className="p-1 text-muted hover:text-red-700"
                    onClick={() => onChange(chosen.filter((l) => l.variantId !== line.variantId))}
                  >
                    <Trash2 size={16} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function BookingWizard({
  services,
  products,
  areas,
  window,
  defaults,
  initialServiceId,
  includeBagFirst,
  policy,
  pickupEnabled,
}: {
  services: BookableService[];
  products: BookingProduct[];
  /** Postcode districts for mobile visits. Empty when mobile booking is off. */
  areas: { district: string }[];
  window: { firstDay: string; lastDay: string };
  defaults: ContactDefaults;
  initialServiceId: number | null;
  includeBagFirst: boolean;
  policy: string;
  pickupEnabled: boolean;
}) {
  const bag = useCart();
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [place, setPlace] = useState<"salon" | "mobile">("salon");
  const [postcode, setPostcode] = useState(defaults.postcode);
  const [addonIds, setAddonIds] = useState<number[]>([]);
  const [staffId, setStaffId] = useState(0);
  const [start, setStart] = useState("");
  const [picked, setPicked] = useState<CartLine[]>([]);
  const [includeBag, setIncludeBag] = useState(includeBagFirst);
  const [receive, setReceive] = useState<"appointment" | "delivery">("appointment");
  const [deliveryPostcode, setDeliveryPostcode] = useState(defaults.postcode);
  const [method, setMethod] = useState<number | null>(null);
  const [code, setCode] = useState("");

  const service = services.find((s) => s.id === serviceId);
  const categories = [...new Set(services.map((s) => s.category))];
  // The service decides where it can happen.
  const mobileOffered = Boolean(service && service.locationMode !== "salon" && areas.length);
  const salonOffered = service?.locationMode !== "mobile";
  const location: "salon" | "mobile" = !service
    ? "salon"
    : !salonOffered
      ? "mobile"
      : mobileOffered
        ? place
        : "salon";
  const mobile = location === "mobile";
  const covered = !mobile || matchPostcode(areas, (a) => a.district, postcode) !== null;
  const locationReady = Boolean(service) && covered && (salonOffered || mobileOffered);
  const people = (service?.staff ?? []).filter((p) => !mobile || p.offersMobile);

  // Chosen products, plus the shop bag if asked for.
  const merged = new Map(picked.map((l) => [l.variantId, l.quantity]));
  if (includeBag) {
    for (const l of bag.items) {
      merged.set(l.variantId, Math.min(20, (merged.get(l.variantId) ?? 0) + l.quantity));
    }
  }
  const items = [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
  const fulfilment = items.length ? receive : "appointment";
  const orderPostcode = mobile ? postcode : deliveryPostcode;

  const { totals, error, loading } = useQuote(
    service && locationReady
      ? {
          booking: { serviceId: service.id, locationType: location, postcode, addonIds },
          order: items.length
            ? { items, fulfilment, deliveryMethodId: method, postcode: orderPostcode }
            : undefined,
          discountCode: code,
        }
      : null,
  );

  const minutes =
    (service?.durationMinutes ?? 0) +
    (service?.addons.filter((a) => addonIds.includes(a.id)) ?? []).reduce(
      (n, a) => n + a.extraMinutes,
      0,
    );
  const needsAddress = mobile || (items.length > 0 && fulfilment === "delivery");
  const resetTime = () => setStart("");
  let step = 1;

  return (
    <div className="space-y-6">
      <Step number={step++} title="Choose a service">
        <div className="space-y-5">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="eyebrow">{category}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {services
                  .filter((s) => s.category === category)
                  .map((s) => {
                    const bookable = s.staff.length > 0 && (s.locationMode !== "mobile" || areas.length > 0);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={serviceId === s.id}
                        disabled={!bookable}
                        onClick={() => {
                          setServiceId(s.id);
                          setStaffId(0);
                          setAddonIds([]);
                          resetTime();
                        }}
                        className={`cursor-pointer rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${serviceId === s.id ? "border-bronze bg-bronze/5 ring-1 ring-bronze" : "border-line hover:border-bronze"}`}
                      >
                        <span className="flex justify-between gap-3 font-semibold">
                          <span>{s.name}</span>
                          <span>{formatPence(s.pricePence)}</span>
                        </span>
                        <span className="text-sm text-muted">
                          {formatDuration(s.durationMinutes)}
                          {s.locationMode === "mobile" && " · At your home"}
                          {s.locationMode === "both" && areas.length > 0 && " · Salon or home"}
                          {!bookable && " · Contact us to book"}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </Step>

      {service && mobileOffered && (
        <Step number={step++} title="Where would you like it?">
          {salonOffered && (
            <div className="mb-4 flex flex-wrap gap-3">
              {(["salon", "mobile"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={location === p}
                  className={`chip ${location === p ? "chip-active" : ""}`}
                  onClick={() => {
                    setPlace(p);
                    setStaffId(0);
                    resetTime();
                  }}
                >
                  {p === "salon" ? "At the salon" : "At my home"}
                </button>
              ))}
            </div>
          )}
          {mobile && (
            <div>
              <label className="label" htmlFor="visit-postcode">
                Your postcode
              </label>
              <input
                id="visit-postcode"
                className="input max-w-48 uppercase"
                value={postcode}
                autoComplete="postal-code"
                onChange={(e) => {
                  setPostcode(e.target.value);
                  resetTime();
                }}
              />
              <p role="status" className="mt-2 text-sm">
                {normalisePostcode(postcode)
                  ? covered
                    ? "Good news, we travel to you."
                    : "Sorry, we do not travel to that postcode yet."
                  : "Enter your full postcode to check we cover your area."}
              </p>
            </div>
          )}
        </Step>
      )}

      {service && locationReady && service.addons.length > 0 && (
        <Step number={step++} title="Add extras">
          <div className="grid gap-2">
            {service.addons.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line p-3 text-sm has-checked:border-bronze has-checked:bg-bronze/5">
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-4 accent-bronze"
                    checked={addonIds.includes(a.id)}
                    onChange={(e) => {
                      setAddonIds(e.target.checked ? [...addonIds, a.id] : addonIds.filter((x) => x !== a.id));
                      resetTime();
                    }}
                  />
                  {a.name}
                  {a.extraMinutes > 0 && <span className="text-muted">+{formatDuration(a.extraMinutes)}</span>}
                </span>
                <span className="font-semibold">+{formatPence(a.pricePence)}</span>
              </label>
            ))}
          </div>
        </Step>
      )}

      {service && locationReady && (
        <Step number={step++} title="Choose your stylist">
          <div className="flex flex-wrap gap-3">
            {[{ id: 0, name: "Anyone available", title: "" }, ...people].map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={staffId === p.id}
                className={`chip ${staffId === p.id ? "chip-active" : ""}`}
                onClick={() => {
                  setStaffId(p.id);
                  resetTime();
                }}
              >
                {p.name}
                {p.title && <span className="opacity-70"> · {p.title}</span>}
              </button>
            ))}
          </div>
        </Step>
      )}

      {service && locationReady && (
        <Step number={step++} title="Pick a date and time">
          <p className="mb-3 text-sm text-muted">Allow about {formatDuration(minutes)}.</p>
          <SlotPicker
            key={`${service.id}-${staffId}-${location}-${mobile ? postcode : ""}-${addonIds.join(".")}`}
            window={window}
            value={start}
            onChange={setStart}
            load={(dateKey) =>
              fetchSlots({
                serviceId: service.id,
                staffId: staffId || null,
                dateKey,
                locationType: location,
                postcode: mobile ? postcode : "",
                addonIds,
              })
            }
          />
        </Step>
      )}

      {service && start && products.length > 0 && (
        <Step number={step++} title="Need hair or products? (optional)">
          <p className="mb-4 text-sm text-muted">
            Add extensions or care products now and pay for everything in one go.
          </p>
          {bag.items.length > 0 && (
            <label className="mb-4 flex items-center gap-2 rounded-xl bg-sand p-3 text-sm">
              <input type="checkbox" className="size-4 accent-bronze" checked={includeBag} onChange={(e) => setIncludeBag(e.target.checked)} />
              Include the {bag.count} item(s) already in my shopping bag
            </label>
          )}
          <ProductPicker
            products={products}
            suggested={service.suggestedCategoryId}
            chosen={picked}
            onChange={setPicked}
          />
        </Step>
      )}

      {service && start && (
        <Step number={step++} title="Your details and summary">
          {!defaults.signedIn && (
            <p className="mb-4 rounded-lg bg-sand px-4 py-3 text-sm">
              Booking as a guest.{" "}
              <Link href="/sign-in?next=/book" className="link">
                Sign in
              </Link>{" "}
              if you would like this saved to your history.
            </p>
          )}
          <ActionForm action={submitCheckout} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="serviceId" value={service.id} />
            <input type="hidden" name="staffId" value={staffId} />
            <input type="hidden" name="start" value={start} />
            <input type="hidden" name="locationType" value={location} />
            <input type="hidden" name="addonIds" value={JSON.stringify(addonIds)} />
            <input type="hidden" name="items" value={JSON.stringify(items)} />
            <input type="hidden" name="fulfilment" value={fulfilment} />
            <Honeypot />
            <Field name="customerName" label="Full name" autoComplete="name" required defaultValue={defaults.customerName} wrapperClass="sm:col-span-2" />
            <Field name="customerEmail" label="Email" type="email" autoComplete="email" required defaultValue={defaults.customerEmail} />
            <Field name="customerPhone" label="Phone" type="tel" autoComplete="tel" required defaultValue={defaults.customerPhone} />

            {items.length > 0 && (
              <fieldset className="space-y-2 sm:col-span-2">
                <legend className="label">How will you get your products?</legend>
                <div className="flex flex-wrap gap-3">
                  {(
                    [
                      ["appointment", mobile ? "Stylist brings them" : "Collect at my appointment"],
                      ["delivery", "Deliver them to me"],
                    ] as const
                  ).map(([value, text]) => (
                    <button key={value} type="button" aria-pressed={receive === value} className={`chip ${receive === value ? "chip-active" : ""}`} onClick={() => setReceive(value)}>
                      {text}
                    </button>
                  ))}
                </div>
                {!pickupEnabled && receive === "appointment" && !mobile && (
                  <p className="text-xs text-muted">Your products will be ready at your appointment.</p>
                )}
              </fieldset>
            )}

            {needsAddress && (
              <>
                <p className="text-sm font-semibold sm:col-span-2">
                  {mobile ? "Where should your stylist come?" : "Delivery address"}
                </p>
                <Field name="addressLine1" label="Address" autoComplete="address-line1" required defaultValue={defaults.addressLine1} wrapperClass="sm:col-span-2" />
                <Field name="addressLine2" label="Address line 2 (optional)" autoComplete="address-line2" defaultValue={defaults.addressLine2} wrapperClass="sm:col-span-2" />
                <Field name="city" label="Town or city" autoComplete="address-level2" required defaultValue={defaults.city} />
                {mobile ? (
                  <Field name="postcode" label="Postcode" readOnly value={postcode.toUpperCase()} hint="Change it in the location step above." />
                ) : (
                  <Field name="postcode" label="Postcode" autoComplete="postal-code" required value={deliveryPostcode} onChange={(e) => setDeliveryPostcode(e.target.value)} />
                )}
              </>
            )}
            {items.length > 0 && fulfilment === "delivery" && (
              <div className="sm:col-span-2">
                <DeliveryChoice options={totals?.order?.deliveryOptions ?? []} selected={method} onSelect={setMethod} postcodeEntered={Boolean(orderPostcode)} />
              </div>
            )}

            <TextArea name="notes" label="Anything we should know? (optional)" rows={3} maxLength={500} wrapperClass="sm:col-span-2" />
            <Field name="photos" label="Reference photos (optional)" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hint="Show us the style you want. Up to 3 photos, 5 MB in total. Only the salon can see them." wrapperClass="sm:col-span-2" />
            <div className="sm:col-span-2">
              <DiscountField value={code} onChange={setCode} error={totals?.discountError} applied={totals?.discountCode} />
            </div>

            <div className="rounded-xl bg-sand p-4 sm:col-span-2" aria-live="polite">
              <p className="mb-3 font-semibold">
                {formatDateTime(new Date(start))}
                {mobile ? " · at your home" : " · at the salon"}
              </p>
              {totals ? <SummaryLines totals={totals} /> : <p className="text-sm">Calculating…</p>}
              {error && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              {totals?.booking?.needsApproval && (
                <p className="mt-3 text-sm font-medium">
                  This is a request. We will review it and email you a payment link if anything is
                  due. Nothing is charged now.
                </p>
              )}
              <p className="mt-3 text-xs text-muted">{policy}</p>
            </div>
            <div className="sm:col-span-2">
              <MarketingChoices />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton className="btn btn-primary w-full" disabled={loading || Boolean(error) || !totals}>
                {totals?.booking?.needsApproval
                  ? "Send booking request"
                  : totals && totals.dueNowPence > 0
                    ? `Continue to pay ${formatPence(totals.dueNowPence)}`
                    : "Confirm booking"}
              </SubmitButton>
            </div>
          </ActionForm>
        </Step>
      )}
    </div>
  );
}
