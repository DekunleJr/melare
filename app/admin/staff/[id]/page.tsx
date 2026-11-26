import { and, asc, eq, gt, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { StaffForm } from "@/components/admin/staff-form";
import { ActionButton, AdminHeader, Created } from "@/components/admin/ui";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { db } from "@/db";
import { services, staff, staffServices, timeOff, workingHours } from "@/db/schema";
import { addTimeOff, deleteStaff, removeTimeOff, saveHours } from "@/features/admin/catalog-actions";
import { env } from "@/lib/env";
import { requireAdmin } from "@/lib/session";
import { readSettings } from "@/lib/settings";
import { feedToken } from "@/lib/tokens";
import { formatDateTime, minutesToTime, WEEKDAYS } from "@/lib/time";

export const metadata = { title: "Team member" };

const timeInput = (name: string, label: string, value: number | undefined) => (
  <label className="text-xs text-muted">
    {label}
    <input type="time" name={name} className="input" defaultValue={value === undefined ? "" : minutesToTime(value)} />
  </label>
);

export default async function EditStaffPage({ params, searchParams }: PageProps<"/admin/staff/[id]">) {
  await connection();
  await requireAdmin();
  const id = Number((await params).id) || 0;
  const [person] = await db.select().from(staff).where(eq(staff.id, id));
  if (!person) notFound();
  const list = await db.select().from(services).where(ne(services.status, "archived")).orderBy(asc(services.name));
  const links = await db.select().from(staffServices).where(eq(staffServices.staffId, id));
  const hours = await db.select().from(workingHours).where(eq(workingHours.staffId, id)).orderBy(asc(workingHours.startMinute));
  const away = await db
    .select()
    .from(timeOff)
    .where(and(eq(timeOff.staffId, id), gt(timeOff.endsAt, new Date())))
    .orderBy(asc(timeOff.startsAt));

  const settings = await readSettings();

  return (
    <div className="max-w-3xl space-y-6">
      <AdminHeader title={person.name}>
        <ActionButton action={deleteStaff.bind(null, id)} confirm="Delete this team member?" danger>
          Delete
        </ActionButton>
      </AdminHeader>
      <Created show={(await searchParams).created} />
      <StaffForm person={person} serviceList={list} assigned={links.map((l) => l.serviceId)} />

      <section className="card">
        <h2 className="mb-2 font-display text-2xl">Calendar link</h2>
        <p className="mb-3 text-sm text-muted">
          Subscribe to this in Google, Apple or Outlook calendar to see {person.name}&apos;s
          bookings. It updates by itself. Anyone with the link can see them, so share it carefully.
        </p>
        <input
          className="input"
          readOnly
          aria-label="Calendar subscription link"
          value={`${env.siteUrl}/api/calendar/${feedToken("staff", String(id), settings.calendarNonce)}.ics`}
        />
      </section>

      <section className="card">
        <h2 className="font-display text-2xl">Weekly hours</h2>
        <p className="mb-4 text-sm text-muted">Customers can only book inside these hours. Breaks are optional.</p>
        <ActionForm action={saveHours.bind(null, id)} className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 0].map((weekday) => {
            const shifts = hours.filter((h) => h.weekday === weekday);
            const first = shifts[0];
            const last = shifts.at(-1);
            const hasBreak = shifts.length > 1;
            return (
              <div key={weekday} className="grid grid-cols-2 items-end gap-2 border-b border-line pb-3 sm:grid-cols-5">
                <label className="col-span-2 flex items-center gap-2 text-sm font-medium sm:col-span-1 sm:pb-3">
                  <input type="checkbox" name={`open_${weekday}`} className="size-4 accent-clay" defaultChecked={shifts.length > 0} />
                  {WEEKDAYS[weekday]}
                </label>
                {timeInput(`start_${weekday}`, "Start", first?.startMinute ?? 9 * 60)}
                {timeInput(`end_${weekday}`, "Finish", last?.endMinute ?? 17 * 60)}
                {timeInput(`breakStart_${weekday}`, "Break from", hasBreak ? first.endMinute : undefined)}
                {timeInput(`breakEnd_${weekday}`, "Break to", hasBreak ? shifts[1].startMinute : undefined)}
              </div>
            );
          })}
          <SubmitButton>Save hours</SubmitButton>
        </ActionForm>
      </section>

      <section className="card space-y-4">
        <h2 className="font-display text-2xl">Time off and holidays</h2>
        <ActionForm action={addTimeOff.bind(null, id)} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
          <Field name="startsAt" label="From" type="datetime-local" required />
          <Field name="endsAt" label="Until" type="datetime-local" required />
          <Field name="reason" label="Reason (private)" wrapperClass="sm:col-span-2" />
          <div className="sm:col-span-2">
            <SubmitButton className="btn btn-outline">Add time off</SubmitButton>
          </div>
        </ActionForm>
        <ul className="divide-y divide-line">
          {away.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span>
                {formatDateTime(o.startsAt)} to {formatDateTime(o.endsAt)}
                {o.reason && <span className="text-muted"> · {o.reason}</span>}
              </span>
              <ActionButton action={removeTimeOff.bind(null, o.id)} danger>
                Remove
              </ActionButton>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
