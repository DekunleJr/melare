"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ComponentProps } from "react";

type LinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

/** A navigation link that is shaded grey while its page, or a page beneath it, is open. */
export function NavLink({
  exact = false,
  activeClassName = "aria-[current=page]:bg-neutral-700",
  className = "",
  ...props
}: LinkProps & {
  /** For section roots such as /admin, which would otherwise match every page beneath them */
  exact?: boolean;
  /** How the current page is marked: grey, in a shade to suit the background */
  activeClassName?: string;
}) {
  const link = { ...props, className: `${className} ${activeClassName}` };
  // On pages with an address only known per request, the shading appears once it is read.
  return (
    <Suspense fallback={<Link {...link} />}>
      <CurrentLink {...link} exact={exact} />
    </Suspense>
  );
}

function CurrentLink({ exact, ...props }: LinkProps & { exact: boolean }) {
  const pathname = usePathname();
  const current = pathname === props.href || (!exact && pathname.startsWith(`${props.href}/`));
  return <Link {...props} aria-current={current ? "page" : undefined} />;
}
