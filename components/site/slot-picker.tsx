"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { formatDate, formatTime, weekdayOfKey } from "@/lib/time";

type Window = { firstDay: string; lastDay: string };

const monthLabel = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function shiftMonth(month: string, by: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + by);
  return date.toISOString().slice(0, 7);
}

/** Month calendar plus the free times on the chosen day. */
export function SlotPicker({
  window,
  load,
  value,
  onChange,
}: {
  window: Window;
  load: (dateKey: string) => Promise<string[]>;
  value: string;
  onChange: (start: string) => void;
}) {
  const [month, setMonth] = useState(window.firstDay.slice(0, 7));
  const [day, setDay] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const latestRequest = useRef("");

  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const leading = (weekdayOfKey(`${month}-01`) + 6) % 7; // Monday first

  function choose(key: string) {
    latestRequest.current = key;
    setDay(key);
    setSlots([]);
    setFailed(false);
    onChange("");
    startTransition(async () => {
      try {
        const result = await load(key);
        // Ignore replies for a day the visitor has since moved away from.
        if (latestRequest.current === key) setSlots(result);
      } catch {
        if (latestRequest.current === key) setFailed(true);
      }
    });
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            className="p-2 disabled:opacity-30"
            aria-label="Previous month"
            disabled={month <= window.firstDay.slice(0, 7)}
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <p className="font-semibold">{monthLabel.format(new Date(`${month}-01T00:00:00Z`))}</p>
          <button
            type="button"
            className="p-2 disabled:opacity-30"
            aria-label="Next month"
            disabled={month >= window.lastDay.slice(0, 7)}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
            <span key={d} className="py-1 text-xs text-muted">
              {d}
            </span>
          ))}
          {Array.from({ length: leading }, (_, i) => (
            <span key={`blank-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const key = `${month}-${String(i + 1).padStart(2, "0")}`;
            const open = key >= window.firstDay && key <= window.lastDay;
            return (
              <button
                key={key}
                type="button"
                disabled={!open}
                aria-pressed={day === key}
                aria-label={formatDate(new Date(`${key}T12:00:00Z`))}
                onClick={() => choose(key)}
                className={`aspect-square rounded-full transition-colors ${
                  day === key
                    ? "bg-gold font-semibold text-black"
                    : open
                      ? "cursor-pointer hover:bg-sand"
                      : "text-muted/40"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
      <div aria-live="polite">
        {!day ? (
          <p className="text-sm text-muted">Choose a date to see available times.</p>
        ) : pending ? (
          <p className="text-sm text-muted">Finding times…</p>
        ) : failed ? (
          <p role="alert" className="text-sm text-red-700">
            We could not load times. Please choose the date again.
          </p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted">No times left on this day. Please try another.</p>
        ) : (
          <>
            <p className="mb-3 text-sm font-medium">{formatDate(new Date(`${day}T12:00:00Z`))}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  aria-pressed={value === slot}
                  className={`chip px-2 text-center ${value === slot ? "chip-active" : ""}`}
                  onClick={() => onChange(slot)}
                >
                  {formatTime(new Date(slot))}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
