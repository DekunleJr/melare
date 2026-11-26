import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/misc";
import type { PaymentWithRefunds } from "@/features/payments/ledger";
import type { FormAction } from "@/lib/forms";
import { label } from "@/lib/labels";
import { formatPence, penceToInput } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { Table } from "./ui";

export function PaymentTable({
  payments,
  part,
}: {
  payments: PaymentWithRefunds[];
  part: "order" | "booking";
}) {
  const key = part === "order" ? "orderPence" : "bookingPence";
  const shown = payments.filter((p) => p.status !== "cancelled" && p.status !== "expired");
  return (
    <Table head={["Payment", "Date", "Method", "Amount", "Refunded", "Status"]} empty="No payments yet.">
      {shown.map((p) => (
        <tr key={p.id}>
          <td>
            {p.reference}
            {p.captureId && <span className="block text-xs text-muted">{p.captureId}</span>}
            {p.note && <span className="block text-xs text-muted">{p.note}</span>}
          </td>
          <td>{formatDateTime(p.completedAt ?? p.createdAt)}</td>
          <td>{label(p.method)}</td>
          <td>{formatPence(p[key])}</td>
          <td>{formatPence(p.refunds.reduce((n, r) => n + r[key], 0))}</td>
          <td>
            <StatusBadge status={p.status} />
          </td>
        </tr>
      ))}
    </Table>
  );
}

export function RefundForm({ action, available }: { action: FormAction; available: number }) {
  return (
    <section className="card">
      <h2 className="font-display text-2xl">Refund</h2>
      <p className="mb-3 text-sm text-muted">
        Up to {formatPence(available)}. PayPal payments are returned automatically; cash, card
        reader, bank and old Stripe payments are only recorded here. A refund is not added to what
        the customer still owes.
      </p>
      <ActionForm action={action} confirm="Make this refund?" className="grid gap-3 sm:grid-cols-2">
        <Field name="amount" label="Amount (£)" inputMode="decimal" required defaultValue={penceToInput(available)} />
        <Field name="note" label="Reason (private)" />
        <div className="sm:col-span-2">
          <SubmitButton className="btn btn-danger">Refund</SubmitButton>
        </div>
      </ActionForm>
    </section>
  );
}
