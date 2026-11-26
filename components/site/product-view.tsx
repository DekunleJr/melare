"use client";

import { ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Photo } from "@/components/ui/misc";
import { VARIANT_OPTIONS, type VariantOption } from "@/features/pricing";
import { formatPence } from "@/lib/money";
import { cart } from "./cart-store";

export type ViewVariant = Record<VariantOption, string> & {
  id: number;
  label: string;
  nowPence: number;
  pricePence: number;
  stock: number;
  lowStockThreshold: number;
  imagePath: string | null;
};

const titles: Record<VariantOption, string> = {
  colour: "Colour",
  length: "Length",
  texture: "Texture",
  size: "Size",
};

/** Pictures, option pickers, price and the add-to-bag button for one product. */
export function ProductView({
  name,
  images,
  variants,
  children,
  heading,
}: {
  name: string;
  images: string[];
  variants: ViewVariant[];
  heading: React.ReactNode;
  children: React.ReactNode;
}) {
  const first = variants.find((v) => v.stock > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState(first?.id);
  const [picture, setPicture] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const selected = variants.find((v) => v.id === selectedId) ?? first;
  const used = VARIANT_OPTIONS.filter((key) => variants.some((v) => v[key]));
  const gallery = [
    ...new Set([...images, ...variants.flatMap((v) => (v.imagePath ? [v.imagePath] : []))]),
  ];
  const shown = picture ?? selected?.imagePath ?? gallery[0];

  /** Keep the other choices where possible when one option changes. */
  function choose(key: VariantOption, value: string) {
    const matches = variants.filter((v) => v[key] === value);
    const score = (v: ViewVariant) =>
      used.filter((k) => v[k] === selected?.[k]).length * 2 + (v.stock > 0 ? 1 : 0);
    const best = [...matches].sort((a, b) => score(b) - score(a))[0];
    if (!best) return;
    setSelectedId(best.id);
    setPicture(null);
    setQuantity(1);
    setAdded(false);
  }

  return (
    <div className="mt-5 grid gap-10 lg:grid-cols-2">
      <div>
        <Photo src={shown} alt={name} preload sizes="(min-width: 1024px) 50vw, 100vw" className="aspect-square rounded-3xl" />
        {gallery.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {gallery.map((src, i) => (
              <button
                key={src}
                type="button"
                aria-label={`Show image ${i + 1}`}
                aria-pressed={shown === src}
                onClick={() => setPicture(src)}
                className={`relative size-20 cursor-pointer overflow-hidden rounded-xl border-2 ${shown === src ? "border-bronze" : "border-transparent"}`}
              >
                <Image src={src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        {heading}
        {selected ? (
          <>
            <p className="mt-4 text-2xl font-semibold" aria-live="polite">
              {formatPence(selected.nowPence)}
              {selected.nowPence < selected.pricePence && (
                <>
                  <s className="ml-3 text-lg font-normal text-muted">
                    <span className="sr-only">Was </span>
                    {formatPence(selected.pricePence)}
                  </s>
                  <span className="ml-3 rounded-full bg-red-100 px-2.5 py-0.5 text-xs text-red-800">
                    Sale
                  </span>
                </>
              )}
            </p>
            {children}
            <div className="space-y-4">
              {used.map((key) => (
                <fieldset key={key}>
                  <legend className="label">
                    {titles[key]}
                    {selected[key] && <span className="font-normal text-muted">: {selected[key]}</span>}
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(variants.map((v) => v[key]).filter(Boolean))].map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={selected[key] === value}
                        className={`chip ${selected[key] === value ? "chip-active" : ""}`}
                        onClick={() => choose(key, value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            {selected.stock > 0 && selected.stock <= selected.lowStockThreshold && (
              <p className="mt-3 text-sm text-amber-800">Only {selected.stock} left.</p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {selected.stock > 0 ? (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    Quantity
                    <select className="input w-20" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
                      {Array.from({ length: Math.min(selected.stock, 10) }, (_, i) => (
                        <option key={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      cart.add(selected.id, quantity);
                      setAdded(true);
                    }}
                  >
                    <ShoppingBag size={16} /> Add to bag
                  </button>
                </>
              ) : (
                <button className="btn btn-primary" disabled>
                  Sold out
                </button>
              )}
              <p role="status" className="w-full text-sm">
                {added && (
                  <>
                    Added to your bag.{" "}
                    <Link href="/cart" className="link">
                      View bag
                    </Link>
                  </>
                )}
              </p>
            </div>
          </>
        ) : (
          <>
            {children}
            <p className="text-muted">This product is not available at the moment.</p>
          </>
        )}
      </div>
    </div>
  );
}
