import { asc } from "drizzle-orm";
import Link from "next/link";
import { ActionButton, AdminHeader } from "@/components/admin/ui";
import { ActionForm, Checkbox, Field, SubmitButton } from "@/components/ui/form";
import { db } from "@/db";
import { mobileAreas } from "@/db/schema";
import { deleteMobileArea, saveMobileArea } from "@/features/admin/commerce-actions";
import { penceToInput } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { readSettings } from "@/lib/settings";

export const metadata = { title: "Mobile areas" };

function AreaForm({ area }: { area?: typeof mobileAreas.$inferSelect }) {
  return (
    <ActionForm action={saveMobileArea.bind(null, area?.id ?? null)} resetOnSuccess={!area} className="grid grid-cols-2 items-end gap-3 sm:grid-cols-5">
      <Field name="districts" label={area ? "District" : "Districts"} required defaultValue={area?.district} placeholder="M1, M14, SK" />
      <Field name="fee" label="Travel fee (£)" inputMode="decimal" required defaultValue={area ? penceToInput(area.feePence) : ""} />
      <Field name="travelMinutes" label="Travel minutes" type="number" min={0} step={5} required defaultValue={area?.travelMinutes ?? 30} />
      <div className="pb-3">
        <Checkbox name="active" label="Covered" defaultChecked={area?.active ?? true} />
      </div>
      <SubmitButton className={`btn btn-sm ${area ? "btn-outline" : "btn-primary"}`}>
        {area ? "Save" : "Add areas"}
      </SubmitButton>
    </ActionForm>
  );
}

export default async function AreasPage() {
  await requireAdmin();
  const areas = await db.select().from(mobileAreas).orderBy(asc(mobileAreas.district));
  const settings = await readSettings();
  const warning = !settings.mobileEnabled
    ? "Mobile bookings are switched off in Settings."
    : !areas.some((a) => a.active)
      ? "Add at least one area, or customers cannot book a mobile visit."
      : "";

  return (
    <div className="max-w-3xl space-y-4">
      <AdminHeader title="Mobile service areas" />
      <p className="text-sm text-muted">
        The postcodes you travel to, with the fee and journey time for each. A district such as M14
        is used before a whole area such as M. Journey time is blocked in the diary before and after
        the visit. Also tick &quot;mobile&quot; on the <Link href="/admin/services" prefetch={false} className="link">services</Link> and{" "}
        <Link href="/admin/staff" prefetch={false} className="link">staff</Link> that offer it.
      </p>
      {warning && (
        <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          {warning}
        </p>
      )}
      <div className="card">
        <AreaForm />
      </div>
      {areas.map((area) => (
        <div key={area.id} className="card space-y-3">
          <AreaForm area={area} />
          <ActionButton action={deleteMobileArea.bind(null, area.id)} confirm="Remove this area?" danger>
            Remove
          </ActionButton>
        </div>
      ))}
    </div>
  );
}
