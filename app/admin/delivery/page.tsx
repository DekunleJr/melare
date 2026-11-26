import { asc } from "drizzle-orm";
import { ActionButton, AdminHeader } from "@/components/admin/ui";
import { ActionForm, Checkbox, Field, SubmitButton } from "@/components/ui/form";
import { db } from "@/db";
import { deliveryMethods } from "@/db/schema";
import { deleteDeliveryMethod, saveDeliveryMethod } from "@/features/admin/commerce-actions";
import { penceToInput } from "@/lib/money";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Delivery" };

function MethodForm({ method }: { method?: typeof deliveryMethods.$inferSelect }) {
  return (
    <ActionForm action={saveDeliveryMethod.bind(null, method?.id ?? null)} resetOnSuccess={!method} className="grid gap-3 sm:grid-cols-3">
      <Field name="name" label="Name" required defaultValue={method?.name} placeholder="Express delivery" />
      <Field name="description" label="Description" defaultValue={method?.description} placeholder="1 to 2 working days" wrapperClass="sm:col-span-2" />
      <Field name="price" label="Price (£)" inputMode="decimal" required defaultValue={method ? penceToInput(method.pricePence) : ""} />
      <Field name="freeOver" label="Free over (£)" inputMode="decimal" defaultValue={method?.freeOverPence ? penceToInput(method.freeOverPence) : ""} hint="Empty means never free." />
      <Field name="sortOrder" label="Order" type="number" min={0} required defaultValue={method?.sortOrder ?? 0} />
      <Field name="postcodes" label="Only for these postcodes" defaultValue={method?.postcodes.replaceAll(",", ", ")} hint="Districts (M1, M14) or areas (M, SK). Empty means everywhere." wrapperClass="sm:col-span-3" />
      <div className="flex items-center gap-4 sm:col-span-3">
        <Checkbox name="active" label="Offered" defaultChecked={method?.active ?? true} />
        <SubmitButton className={`btn btn-sm ${method ? "btn-outline" : "btn-primary"}`}>
          {method ? "Save" : "Add delivery option"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function DeliveryPage() {
  await requireAdmin();
  const methods = await db
    .select()
    .from(deliveryMethods)
    .orderBy(asc(deliveryMethods.sortOrder), asc(deliveryMethods.id));
  return (
    <div className="max-w-3xl space-y-4">
      <AdminHeader title="Delivery options" />
      <p className="text-sm text-muted">
        Customers see the options that cover their postcode. Salon collection is switched on or off
        in Settings.
      </p>
      {methods.map((method) => (
        <div key={method.id} className="card space-y-3">
          <MethodForm method={method} />
          <ActionButton action={deleteDeliveryMethod.bind(null, method.id)} confirm="Remove this option?" danger>
            Remove
          </ActionButton>
        </div>
      ))}
      <div className="card border-dashed">
        <MethodForm />
      </div>
    </div>
  );
}
