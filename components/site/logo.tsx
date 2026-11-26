import Image from "next/image";

/**
 * The business logo, for use on black. The artwork has a solid black background;
 * "lighten" blending lets it merge with the slightly softer black behind it.
 * public/images/logo-trimmed.png is Logo.png with the empty margins cut off.
 */
export function Logo({
  name,
  className,
  preload,
}: {
  name: string;
  /** Sets the height; the width follows */
  className: string;
  preload?: boolean;
}) {
  return (
    <Image
      src="/images/logo-trimmed.png"
      alt={name}
      width={240}
      height={156}
      preload={preload}
      className={`w-auto mix-blend-lighten ${className}`}
    />
  );
}
