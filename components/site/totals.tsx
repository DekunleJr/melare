"use client";

import { useEffect, useState } from "react";
import { previewTotals, type QuoteInput, type Totals } from "@/features/checkout/actions";
import { formatPence } from "@/lib/money";

/** Prices the current selection on the server whenever it changes. */
export function useQuote(input: QuoteInput | null) {
  const key = input ? JSON.stringify(input) : "";
  const [state, setState] = useState<{ key: string; totals?: Totals; error?: string }>({
    key: "",
  });

  useEffect(() => {
    if (!key) return;
    let active = true;
    // A short pause avoids a request for every keystroke.
    const timer = setTimeout(() => {
      previewTotals(JSON.parse(key) as QuoteInput)
        .then((result) => {
          if (!active) return;
          if ("error" in result) setState({ key, error: result.error });
          else setState({ key, totals: result });
        })
        .catch(() => active && setState({ key, error: "Could not reach the server." }));
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key]);

  return {
    totals: key ? state.totals : undefined,
    error: key && state.key === key ? state.error : undefined,
    loading: Boolean(key) && state.key !== key,
  };
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="whitespace-nowrap">{value}</span>
    </div>
  );
}

/** The full order summary shown before anyone commits. */
export function SummaryLines({ totals }: { totals: Totals }) {
  const { booking, order } = totals;
  const later = totals.totalPence - totals.dueNowPence;
  return (
    <div className="space-y-4 text-sm">
      {booking && (
        <div className="space-y-1.5">
          <p className="eyebrow">Appointment</p>
          <Row label={booking.name} value={formatPence(booking.pricePence)} />
          {booking.addons.map((a) => (
            <Row key={a.name} label={`+ ${a.name}`} value={formatPence(a.pricePence)} />
          ))}
          {booking.travelFeePence > 0 && (
            <Row label="Travel fee" value={formatPence(booking.travelFeePence)} />
          )}
          {booking.discountPence > 0 && (
            <Row
              label={`Discount ${totals.discountCode}`}
              value={`-${formatPence(booking.discountPence)}`}
            />
          )}
          <Row label="Appointment total" value={formatPence(booking.totalPence)} strong />
        </div>
      )}
      {order && (
        <div className="space-y-1.5 border-t border-line pt-3">
          <p className="eyebrow">Products</p>
          {order.lines.map((l) => (
            <Row key={l.name} label={`${l.quantity} × ${l.name}`} value={formatPence(l.totalPence)} />
          ))}
          {order.deliveryPence > 0 && (
            <Row label="Delivery" value={formatPence(order.deliveryPence)} />
          )}
          {order.discountPence > 0 && (
            <Row
              label={`Discount ${totals.discountCode}`}
              value={`-${formatPence(order.discountPence)}`}
            />
          )}
          <Row label="Products total" value={formatPence(order.totalPence)} strong />
        </div>
      )}
      <div className="space-y-1.5 border-t border-line pt-3 text-base">
        <Row label="Total" value={formatPence(totals.totalPence)} strong />
        <Row
          label={booking?.needsApproval ? "To pay after approval" : "To pay now"}
          value={formatPence(totals.dueNowPence)}
          strong
        />
        {later > 0 && <Row label="To pay at the appointment" value={formatPence(later)} />}
      </div>
    </div>
  );
}

export function DiscountField({
  value,
  onChange,
  error,
  applied,
}: {
  value: string;
  onChange: (code: string) => void;
  error?: string;
  applied?: string;
}) {
  const [typed, setTyped] = useState(value);
  return (
    <div>
      <label className="label" htmlFor="discount-code">
        Discount code
      </label>
      <div className="flex gap-2">
        <input
          id="discount-code"
          className="input uppercase"
          value={typed}
          maxLength={40}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onChange(typed.trim());
            }
          }}
        />
        <button type="button" className="btn btn-outline" onClick={() => onChange(typed.trim())}>
          Apply
        </button>
      </div>
      <p role="status" className={`mt-1 text-sm ${error ? "text-red-700" : "text-emerald-800"}`}>
        {error || (applied ? `${applied} applied.` : "")}
      </p>
      <input type="hidden" name="discountCode" value={error ? "" : value} />
    </div>
  );
}
