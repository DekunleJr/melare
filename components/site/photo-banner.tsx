import Image from "next/image";
import type { ReactNode } from "react";

/** A full-width photo with the page title over it. */
export function PhotoBanner({
  image,
  eyebrow,
  title,
  position = "object-center",
  children,
}: {
  image: string;
  eyebrow: string;
  title: string;
  /** Which part of the photo to keep when it is cropped */
  position?: string;
  children?: ReactNode;
}) {
  return (
    <header className="on-dark relative isolate overflow-hidden bg-black text-cream">
      <Image src={image} alt="" fill preload sizes="100vw" className={`-z-10 object-cover ${position}`} />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/50 to-black/5" />
      <div className="container-page flex min-h-[24rem] flex-col justify-center py-16 sm:min-h-[30rem]">
        <p className="eyebrow text-gold">{eyebrow}</p>
        <h1 className="max-w-2xl font-display text-5xl leading-[1.05] text-cream sm:text-7xl">{title}</h1>
        {children && <div className="mt-5 max-w-xl text-lg text-cream/85">{children}</div>}
      </div>
    </header>
  );
}
