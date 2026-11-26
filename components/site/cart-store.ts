"use client";

import { useSyncExternalStore } from "react";

/** The bag holds only option ids and quantities. Prices always come from the server. */
export type CartLine = { variantId: number; quantity: number };

const KEY = "melare-bag-v2";
const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
let lines: CartLine[] | null = null;

function load(): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is CartLine =>
        Number.isInteger(l?.variantId) && Number.isInteger(l?.quantity) && l.quantity > 0,
    );
  } catch {
    return [];
  }
}

const snapshot = () => (lines ??= load());

function save(next: CartLine[]) {
  lines = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private browsing: the bag still works until the page is closed.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    lines = load();
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const clamp = (n: number) => Math.min(20, Math.max(1, n));

export const cart = {
  add(variantId: number, quantity: number) {
    const current = snapshot();
    const existing = current.find((l) => l.variantId === variantId);
    save(
      existing
        ? current.map((l) =>
            l === existing ? { ...l, quantity: clamp(l.quantity + quantity) } : l,
          )
        : [...current, { variantId, quantity: clamp(quantity) }],
    );
  },
  setQuantity(variantId: number, quantity: number) {
    save(
      snapshot().map((l) =>
        l.variantId === variantId ? { ...l, quantity: clamp(quantity) } : l,
      ),
    );
  },
  remove(variantId: number) {
    save(snapshot().filter((l) => l.variantId !== variantId));
  },
  clear() {
    save([]);
  },
  replace(next: CartLine[]) {
    save(next.map((l) => ({ variantId: l.variantId, quantity: clamp(l.quantity) })));
  },
};

const noop = () => () => {};

export function useCart() {
  const items = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  /** False during server rendering, before the saved bag has been read */
  const ready = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return { items, ready, count: items.reduce((sum, l) => sum + l.quantity, 0) };
}
