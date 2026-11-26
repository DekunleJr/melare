import { ActionForm, Checkbox, Field, SubmitButton } from "@/components/ui/form";
import type { serviceAddons } from "@/db/schema";
import { saveAddon } from "@/features/admin/catalog-actions";
import { penceToInput } from "@/lib/money";

export function AddonForm({
  serviceId,
  addon,
}: {
  serviceId: number;
  addon?: typeof serviceAddons.$inferSelect;
}) {
  return (
    <ActionForm action={saveAddon.bind(null, serviceId, addon?.id ?? null)} resetOnSuccess={!addon} className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
      <Field name="name" label="Extra" required defaultValue={addon?.name} wrapperClass="col-span-2" />
      <Field name="price" label="Price (£)" inputMode="decimal" required defaultValue={addon ? penceToInput(addon.pricePence) : ""} />
      <Field name="extraMinutes" label="Extra minutes" type="number" min={0} step={5} required defaultValue={addon?.extraMinutes ?? 0} />
      <Field name="sortOrder" label="Order" type="number" min={0} required defaultValue={addon?.sortOrder ?? 0} />
      <div className="pb-3">
        <Checkbox name="active" label="Offered" defaultChecked={addon?.active ?? true} />
      </div>
      <SubmitButton className={`btn btn-sm ${addon ? "btn-outline" : "btn-primary"}`}>
        {addon ? "Save extra" : "Add extra"}
      </SubmitButton>
    </ActionForm>
  );
}
