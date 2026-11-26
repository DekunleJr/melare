import { ActionForm, Checkbox, Field, SubmitButton, TextArea } from "@/components/ui/form";
import type { services, staff } from "@/db/schema";
import { saveStaff } from "@/features/admin/catalog-actions";

export function StaffForm({
  person,
  serviceList,
  assigned,
}: {
  person?: typeof staff.$inferSelect;
  serviceList: (typeof services.$inferSelect)[];
  assigned: number[];
}) {
  return (
    <ActionForm action={saveStaff.bind(null, person?.id ?? null)} className="card grid gap-4 sm:grid-cols-2">
      <Field name="name" label="Name" required defaultValue={person?.name} />
      <Field name="title" label="Job title" defaultValue={person?.title} />
      <TextArea name="bio" label="Short biography" defaultValue={person?.bio} wrapperClass="sm:col-span-2" />
      <Field name="image" label={person?.imagePath ? "Replace photo" : "Photo"} type="file" accept="image/jpeg,image/png,image/webp,image/avif" />
      <Field name="sortOrder" label="Display order" type="number" min={0} required defaultValue={person?.sortOrder ?? 0} />
      <div className="flex flex-wrap gap-6 sm:col-span-2">
        <Checkbox name="active" label="Active (shown on the site and bookable)" defaultChecked={person?.active ?? true} />
        <Checkbox name="offersMobile" label="Does mobile (home) visits" defaultChecked={person?.offersMobile} />
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="label">Services they offer</legend>
        <div className="flex flex-wrap gap-4">
          {serviceList.map((s) => (
            <Checkbox key={s.id} name="serviceIds" value={s.id} label={s.name} defaultChecked={assigned.includes(s.id)} />
          ))}
          {!serviceList.length && <p className="text-sm text-muted">No services yet.</p>}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <SubmitButton>{person ? "Save profile" : "Add team member"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
