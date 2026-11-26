"use client";

import { useState } from "react";
import { formatPence } from "@/lib/money";

export type Bar = { label: string; pence: number };

/** Validated against the white card: contrast, lightness and colour strength. */
const SERIES = "#a8452c";

/** A round number at or above the largest value, for the axis. */
function niceMax(value: number) {
  if (value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 4, 5, 8, 10].find((s) => s * magnitude >= value)!;
  return step * magnitude;
}

/**
 * One series of money per period. Bars below the baseline are periods where more
 * was refunded than received. The same figures are in the table underneath.
 */
export function BarChart({ bars, title }: { bars: Bar[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(0, ...bars.map((b) => b.pence))) || 100;
  const bottom = niceMax(Math.max(0, ...bars.map((b) => -b.pence)));
  const range = top + bottom;
  const zero = (bottom / range) * 100;
  const ticks = [top, top / 2, 0, ...(bottom ? [-bottom] : [])];
  const position = (value: number) => ((value + bottom) / range) * 100;
  const shown = active === null ? null : bars[active];
  const labels = new Set([0, Math.floor((bars.length - 1) / 2), bars.length - 1]);

  return (
    <figure>
      <figcaption className="mb-3 text-sm font-semibold">{title}</figcaption>
      <div className="flex gap-3">
        <div className="relative h-56 w-16 shrink-0 text-right text-xs text-muted" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: `${position(t)}%` }}>
              {formatPence(t).replace(/\.00$/, "")}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-56" onMouseLeave={() => setActive(null)}>
            {ticks.map((t) => (
              <span key={t} aria-hidden="true" className={`absolute inset-x-0 h-px ${t === 0 ? "bg-ink/30" : "bg-ink/10"}`} style={{ bottom: `${position(t)}%` }} />
            ))}
            <div className="absolute inset-0 flex items-stretch gap-0.5">
              {bars.map((bar, i) => {
                const height = (Math.abs(bar.pence) / range) * 100;
                const up = bar.pence >= 0;
                return (
                  // The whole column is the hover target, not just the bar.
                  <button
                    key={bar.label}
                    type="button"
                    className="relative flex-1 cursor-default"
                    aria-label={`${bar.label}: ${formatPence(bar.pence)}`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                  >
                    <span
                      className={`absolute left-1/2 w-full max-w-6 -translate-x-1/2 ${up ? "rounded-t" : "rounded-b"}`}
                      style={{
                        height: `${height}%`,
                        minHeight: bar.pence ? 2 : 0,
                        ...(up ? { bottom: `${zero}%` } : { top: `${100 - zero}%` }),
                        background: SERIES,
                        opacity: active === null || active === i ? 1 : 0.45,
                      }}
                    />
                  </button>
                );
              })}
            </div>
            {shown && (
              <div
                role="status"
                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-white px-3 py-2 text-xs whitespace-nowrap shadow-lg"
                style={{ left: `clamp(4rem, ${((active! + 0.5) / bars.length) * 100}%, calc(100% - 4rem))` }}
              >
                <strong className="block text-sm">{formatPence(shown.pence)}</strong>
                <span className="text-muted">{shown.label}</span>
              </div>
            )}
          </div>
          <div className="relative mt-2 h-4 text-xs text-muted" aria-hidden="true">
            {bars.map((bar, i) =>
              labels.has(i) ? (
                <span
                  key={bar.label}
                  className={`absolute whitespace-nowrap ${i === 0 ? "" : i === bars.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
                  style={{ left: `${(i === 0 ? 0 : i === bars.length - 1 ? 1 : (i + 0.5) / bars.length) * 100}%` }}
                >
                  {bar.label}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </figure>
  );
}
