import { asc, eq, ne } from "drizzle-orm";
import { AdminHeader } from "@/components/admin/ui";
import { ActionForm, Checkbox, Field, Select, SubmitButton, TextArea } from "@/components/ui/form";
import { db } from "@/db";
import { services, staff } from "@/db/schema";
import { createManualBooking } from "@/features/admin/sales-actions";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Add booking" };

export default async function NewBookingPage() {
  await requireAdmin();
  const serviceList = await db.select().from(services).where(ne(services.status, "archived")).orderBy(asc(services.name));
  const people = await db.select().from(staff).where(eq(staff.active, true)).orderBy(asc(staff.name));

  return (
    <div className="max-w-2xl">
      <AdminHeader title="Add booking" />
      <p className="mb-4 text-sm text-muted">
        For phone and walk-in customers. No online payment is taken, no approval is needed and shift
        hours are not enforced, but double bookings are still blocked. Record payments on the booking
        afterwards.
      </p>
      <ActionForm action={createManualBooking} className="card grid gap-4 sm:grid-cols-2">
        <Select name="serviceId" label="Service" required>
          {serviceList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select name="staffId" label="Staff member" hint="They must offer the chosen service.">
          <option value={0}>Anyone available</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Field name="start" label="Date and time" type="datetime-local" required />
        <Select name="locationType" label="Where">
          <option value="salon">Salon</option>
          <option value="mobile">Mobile visit (postcode must be in your areas)</option>
        </Select>
        <Field name="customerName" label="Customer name" required wrapperClass="sm:col-span-2" />
        <Field name="customerEmail" label="Email" type="email" required />
        <Field name="customerPhone" label="Phone" type="tel" required />
        <Field name="addressLine1" label="Address (mobile visits)" wrapperClass="sm:col-span-2" />
        <Field name="city" label="Town or city" />
        <Field name="postcode" label="Postcode" />
        <TextArea name="notes" label="Notes" rows={2} wrapperClass="sm:col-span-2" />
        <div className="sm:col-span-2">
          <Checkbox name="notify" label="Email a confirmation to the customer and salon" defaultChecked />
        </div>
        <div className="sm:col-span-2">
          <SubmitButton>Create booking</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
