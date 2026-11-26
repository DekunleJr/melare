import { ActionForm, Checkbox, Field, Select, SubmitButton, TextArea } from "@/components/ui/form";
import type { categories, services, staff } from "@/db/schema";
import { saveService } from "@/features/admin/catalog-actions";
import { penceToInput } from "@/lib/money";

export function ServiceForm({
  service,
  people,
  assigned,
  productCategories,
}: {
  service?: typeof services.$inferSelect;
  productCategories: (typeof categories.$inferSelect)[];
  people: (typeof staff.$inferSelect)[];
  assigned: number[];
}) {
  return (
    <ActionForm action={saveService.bind(null, service?.id ?? null)} className="card grid gap-4 sm:grid-cols-2">
      <Field name="name" label="Service name" required defaultValue={service?.name} />
      <Field name="category" label="Group (e.g. Hair, Nails)" required defaultValue={service?.category} />
      <TextArea name="description" label="Description" rows={5} required defaultValue={service?.description} wrapperClass="sm:col-span-2" />
      <Field name="durationMinutes" label="Duration (minutes)" type="number" min={5} step={5} required defaultValue={service?.durationMinutes ?? 60} />
      <Field name="bufferMinutes" label="Clean-up time after (minutes)" type="number" min={0} step={5} required defaultValue={service?.bufferMinutes ?? 0} />
      <Field name="price" label="Price (£)" inputMode="decimal" required defaultValue={service ? penceToInput(service.pricePence) : ""} />
      <Select name="paymentMode" label="Payment when booking" defaultValue={service?.paymentMode ?? "pay_at_salon"}>
        <option value="pay_at_salon">None, pay at the salon</option>
        <option value="deposit">Deposit online</option>
        <option value="full">Full price online</option>
      </Select>
      <Select name="depositType" label="Deposit is" defaultValue={service?.depositType ?? "fixed"} hint="Only used with Deposit online.">
        <option value="fixed">A fixed amount</option>
        <option value="percent">A percentage of the total</option>
      </Select>
      <Field name="deposit" label="Fixed deposit (£)" inputMode="decimal" defaultValue={service?.depositPence ? penceToInput(service.depositPence) : ""} />
      <Field name="depositPercent" label="Percentage deposit (%)" type="number" min={0} max={100} defaultValue={service?.depositPercent || ""} />
      <Select name="locationMode" label="Where is it offered?" defaultValue={service?.locationMode ?? "salon"}>
        <option value="salon">At the salon only</option>
        <option value="mobile">Mobile (customer&apos;s home) only</option>
        <option value="both">Salon or mobile</option>
      </Select>
      <Select name="suggestedCategoryId" label="Suggest products from" defaultValue={service?.suggestedCategoryId ?? 0} hint="Shown first while booking, e.g. extensions for braids.">
        <option value={0}>All products</option>
        {productCategories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <div className="sm:col-span-2">
        <Checkbox name="requiresApproval" label="I must approve each booking before the customer pays" defaultChecked={service?.requiresApproval} />
      </div>
      <Field name="sortOrder" label="Display order" type="number" min={0} required defaultValue={service?.sortOrder ?? 0} />
      <Select name="status" label="Visibility" defaultValue={service?.status ?? "active"}>
        <option value="active">Active (bookable)</option>
        <option value="draft">Draft (hidden)</option>
        <option value="archived">Archived</option>
      </Select>
      <div className="self-end pb-3">
        <Checkbox name="featured" label="Feature on the home page" defaultChecked={service?.featured} />
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="label">Who offers this service?</legend>
        <div className="flex flex-wrap gap-4">
          {people.map((p) => (
            <Checkbox key={p.id} name="staffIds" value={p.id} label={p.name} defaultChecked={assigned.includes(p.id)} />
          ))}
          {!people.length && (
            <p className="text-sm text-muted">Add staff first. A service needs someone to be bookable.</p>
          )}
        </div>
      </fieldset>
      <Field name="image" label={service?.imagePath ? "Replace main photo" : "Main photo"} type="file" accept="image/jpeg,image/png,image/webp,image/avif" />
      <Field name="photos" label="More hairstyle photos" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple />
      <div className="sm:col-span-2">
        <SubmitButton>{service ? "Save changes" : "Create service"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
