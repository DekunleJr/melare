import { desc } from "drizzle-orm";
import { ActionButton, AdminHeader } from "@/components/admin/ui";
import { ActionForm, Checkbox, Field, Select, SubmitButton } from "@/components/ui/form";
import { db } from "@/db";
import { discountCodes } from "@/db/schema";
import { deleteDiscount, saveDiscount } from "@/features/admin/commerce-actions";
import { formatPence, penceToInput } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { dateKey, formatTime } from "@/lib/time";

export const metadata = { title: "Discount codes" };

const localInput = (date: Date | null) => (date ? `${dateKey(date)}T${formatTime(date)}` : "");

function DiscountForm({ code }: { code?: typeof discountCodes.$inferSelect }) {
  return (
    <ActionForm action={saveDiscount.bind(null, code?.id ?? null)} resetOnSuccess={!code} className="grid gap-3 sm:grid-cols-3">
      <Field name="code" label="Code" required defaultValue={code?.code} placeholder="WELCOME10" />
      <Select name="type" label="Type" defaultValue={code?.type ?? "percent"}>
        <option value="percent">Percentage off</option>
        <option value="fixed">Amount off (£)</option>
      </Select>
      <Field name="value" label="Value" inputMode="decimal" required defaultValue={code ? (code.type === "percent" ? code.value : penceToInput(code.value)) : ""} hint="10 for 10%, or 5.00 for £5." />
      <Select name="appliesTo" label="Applies to" defaultValue={code?.appliesTo ?? "all"}>
        <option value="all">Products and appointments</option>
        <option value="products">Products only</option>
        <option value="services">Appointments only</option>
      </Select>
      <Field name="minSpend" label="Minimum spend (£)" inputMode="decimal" defaultValue={code?.minSpendPence ? penceToInput(code.minSpendPence) : ""} />
      <Field name="maxUses" label="Maximum uses" type="number" min={0} required defaultValue={code?.maxUses ?? 0} hint="0 means unlimited." />
      <Field name="startsAt" label="Starts" type="datetime-local" defaultValue={localInput(code?.startsAt ?? null)} />
      <Field name="endsAt" label="Ends" type="datetime-local" defaultValue={localInput(code?.endsAt ?? null)} />
      <div className="self-end pb-3">
        <Checkbox name="active" label="Active" defaultChecked={code?.active ?? true} />
      </div>
      <div className="sm:col-span-3">
        <SubmitButton className={`btn btn-sm ${code ? "btn-outline" : "btn-primary"}`}>
          {code ? "Save code" : "Create code"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function DiscountsPage() {
  await requireAdmin();
  const codes = await db.select().from(discountCodes).orderBy(desc(discountCodes.id));
  return (
    <div className="max-w-3xl space-y-4">
      <AdminHeader title="Discount codes" />
      <p className="text-sm text-muted">
        Customers type these at checkout. Travel and delivery fees are not discounted. For a sale on
        particular products, set a sale price on the product instead.
      </p>
      <div className="card">
        <DiscountForm />
      </div>
      {codes.map((code) => (
        <details key={code.id} className="card">
          <summary className="cursor-pointer text-sm">
            <strong>{code.code}</strong> ·{" "}
            {code.type === "percent" ? `${code.value}%` : formatPence(code.value)} off · used{" "}
            {code.usedCount}
            {code.maxUses > 0 && ` of ${code.maxUses}`}
            {!code.active && " · inactive"}
          </summary>
          <div className="mt-4 space-y-3">
            <DiscountForm code={code} />
            <ActionButton action={deleteDiscount.bind(null, code.id)} confirm="Delete this code?" danger>
              Delete
            </ActionButton>
          </div>
        </details>
      ))}
    </div>
  );
}
