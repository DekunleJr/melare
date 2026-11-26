import Link from "next/link";
import { connection } from "next/server";
import { EmptyState, StatusBadge } from "@/components/ui/misc";
import { paymentsFor } from "@/features/payments/ledger";
import { label } from "@/lib/labels";
import { formatPence } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { formatShortDate } from "@/lib/time";
import { manageToken } from "@/lib/tokens";

export default async function MyPaymentsPage() {
  await connection();
  const user = await requireUser("/account/payments");
  const now = new Date();
  const payments = (await paymentsFor({ userId: user.id })).filter(
    (p) => p.status === "completed" || (p.status === "pending" && (!p.expiresAt || p.expiresAt > now)),
  );

  return (
    <>
      <h1 className="mb-6 font-display text-4xl">Your payments</h1>
      {!payments.length && <EmptyState title="No payments yet" />}
      <ul className="space-y-3">
        {payments.map((p) => {
          const refunded = p.refunds.reduce((n, r) => n + r.amountPence, 0);
          const token = manageToken("payment", p);
          return (
            <li key={p.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {formatPence(p.amountPence)}
                  <span className="ml-2 text-sm font-normal text-muted">
                    {formatShortDate(p.completedAt ?? p.createdAt)} · {p.reference}
                  </span>
                </p>
                <p className="text-sm text-muted">
                  {label(p.method)}
                  {refunded > 0 && ` · ${formatPence(refunded)} refunded`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={p.status} />
                <Link
                  href={p.status === "completed" ? `/receipt/${token}` : `/pay/${token}`}
                  prefetch={false}
                  className={p.status === "completed" ? "link text-sm" : "btn btn-primary btn-sm"}
                >
                  {p.status === "completed" ? "Receipt" : "Pay now"}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
