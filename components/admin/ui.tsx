import { ArrowLeft, Pencil, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import type { FormState } from "@/lib/forms";

export function AdminHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-3xl sm:text-4xl">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** A round icon button in a table's Action column. The pencil opens a record to edit it. */
export function IconLink({
  href,
  label,
  icon: Icon = Pencil,
}: {
  href: string;
  /** Read out by screen readers and shown on hover */
  label: string;
  icon?: LucideIcon;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-ink transition-colors hover:border-gold-dark hover:bg-gold"
      aria-label={label}
      title={label}
    >
      <Icon size={15} aria-hidden="true" />
    </Link>
  );
}

/** Leaves an edit page without saving. */
export function BackButton({ href }: { href: string }) {
  return (
    <Link href={href} prefetch={false} className="btn btn-outline btn-sm">
      <ArrowLeft size={15} aria-hidden="true" />
      Back
    </Link>
  );
}

export function Created({ show }: { show: unknown }) {
  if (!show) return null;
  return (
    <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      Created successfully.
    </p>
  );
}

/** A single button that runs a server action. */
export function ActionButton({
  action,
  children,
  confirm,
  danger,
}: {
  action: () => Promise<FormState>;
  children: ReactNode;
  confirm?: string;
  danger?: boolean;
}) {
  return (
    <ActionForm action={action} confirm={confirm} className="inline-flex flex-col gap-1">
      <SubmitButton className={`btn btn-sm ${danger ? "btn-danger" : "btn-outline"}`}>
        {children}
      </SubmitButton>
    </ActionForm>
  );
}

export function Table({
  head,
  children,
  empty,
}: {
  head: string[];
  children: ReactNode[];
  empty: string;
}) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={`Table: ${head.filter(Boolean).join(", ")}`}>
      <table className="table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children.length ? (
            children
          ) : (
            <tr>
              <td colSpan={head.length} className="py-10 text-center text-muted">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export const PAGE_SIZE = 25;

export const queryText = (value: string | string[] | undefined) =>
  ((Array.isArray(value) ? value[0] : value) ?? "").trim().slice(0, 100);

export const queryPage = (value: string | string[] | undefined) =>
  Math.max(1, Math.floor(Number(queryText(value))) || 1);

export function Pagination({
  base,
  page,
  hasMore,
  params = {},
}: {
  base: string;
  page: number;
  hasMore: boolean;
  params?: Record<string, string>;
}) {
  if (page === 1 && !hasMore) return null;
  const href = (p: number) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    query.set("page", String(p));
    return `${base}?${query}`;
  };
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} prefetch={false} className="link">
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">Page {page}</span>
      {hasMore ? (
        <Link href={href(page + 1)} prefetch={false} className="link">
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
