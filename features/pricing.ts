// Pure pricing rules: no database, no framework, fully unit tested.
import { formatPence } from "@/lib/money";
import { matchPostcode } from "@/lib/postcode";

export function variantPrice(v: { pricePence: number; salePricePence: number }): number {
  return v.salePricePence > 0 && v.salePricePence < v.pricePence
    ? v.salePricePence
    : v.pricePence;
}

export const isOnSale = (v: { pricePence: number; salePricePence: number }) =>
  variantPrice(v) < v.pricePence;

export const VARIANT_OPTIONS = ["colour", "length", "texture", "size"] as const;
export type VariantOption = (typeof VARIANT_OPTIONS)[number];

export function variantLabel(v: Record<VariantOption, string>): string {
  return VARIANT_OPTIONS.map((k) => v[k])
    .filter(Boolean)
    .join(" / ");
}

export type Discount = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  appliesTo: "all" | "products" | "services";
  minSpendPence: number;
  startsAt: Date | null;
  endsAt: Date | null;
  maxUses: number;
  usedCount: number;
  active: boolean;
};

export type Subtotals = { productsPence: number; servicesPence: number };

/** Why a code cannot be used, or null if it can. */
export function discountProblem(d: Discount, totals: Subtotals, now = new Date()): string | null {
  if (!d.active || (d.startsAt && now < d.startsAt)) return "That code is not valid.";
  if (d.endsAt && now > d.endsAt) return "That code has expired.";
  if (d.maxUses > 0 && d.usedCount >= d.maxUses) return "That code has been fully used.";
  const eligible =
    d.appliesTo === "products"
      ? totals.productsPence
      : d.appliesTo === "services"
        ? totals.servicesPence
        : totals.productsPence + totals.servicesPence;
  if (eligible === 0) {
    return d.appliesTo === "products"
      ? "That code is for products only."
      : "That code is for appointments only.";
  }
  if (eligible < d.minSpendPence) {
    return `Spend ${formatPence(d.minSpendPence)} or more to use that code.`;
  }
  return null;
}

/** How much comes off the products and off the appointment. */
export function discountSplit(d: Discount, totals: Subtotals) {
  const products = d.appliesTo === "services" ? 0 : totals.productsPence;
  const services = d.appliesTo === "products" ? 0 : totals.servicesPence;
  if (d.type === "percent") {
    const percent = Math.min(100, d.value);
    return {
      products: Math.floor((products * percent) / 100),
      services: Math.floor((services * percent) / 100),
    };
  }
  // A fixed amount comes off products first, then the appointment.
  const fromProducts = Math.min(d.value, products);
  return { products: fromProducts, services: Math.min(d.value - fromProducts, services) };
}

/** How much of an appointment is collected online when booking. */
export function depositDue(
  service: {
    paymentMode: "pay_at_salon" | "deposit" | "full";
    depositType: "fixed" | "percent";
    depositPence: number;
    depositPercent: number;
  },
  totalPence: number,
): number {
  if (service.paymentMode === "full") return totalPence;
  if (service.paymentMode !== "deposit") return 0;
  const deposit =
    service.depositType === "percent"
      ? Math.round((totalPence * service.depositPercent) / 100)
      : service.depositPence;
  return Math.max(0, Math.min(deposit, totalPence));
}

export type DeliveryOption = {
  id: number;
  name: string;
  description: string;
  pricePence: number;
  freeOverPence: number;
  postcodes: string;
};

export function deliveryPrice(method: DeliveryOption, productsPence: number): number {
  return method.freeOverPence > 0 && productsPence >= method.freeOverPence
    ? 0
    : method.pricePence;
}

/** Methods with no postcode list are offered everywhere. */
export function deliversTo(method: { postcodes: string }, postcode: string): boolean {
  const list = method.postcodes.split(",").filter(Boolean);
  return !list.length || matchPostcode(list, (d) => d, postcode) !== null;
}
