import { ChangePasswordForm, DeleteAccountForm } from "@/components/site/auth-forms";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { getContactDefaults } from "@/features/account/queries";
import { saveProfile } from "@/features/site/actions";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { feedToken } from "@/lib/tokens";

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  const d = await getContactDefaults();
  const calendar = `${env.siteUrl}/api/calendar/${feedToken("user", user.id)}.ics`;
  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl">Your details</h1>
      <div className="card">
        <p className="mb-4 text-sm text-muted">
          Signed in as {user.name} ({user.email}). These details prefill booking and checkout.
        </p>
        <ActionForm action={saveProfile} className="grid gap-4 sm:grid-cols-2">
          <Field name="phone" label="Phone" type="tel" autoComplete="tel" defaultValue={d.customerPhone} wrapperClass="sm:col-span-2" />
          <Field name="addressLine1" label="Address" autoComplete="address-line1" defaultValue={d.addressLine1} wrapperClass="sm:col-span-2" />
          <Field name="addressLine2" label="Address line 2" autoComplete="address-line2" defaultValue={d.addressLine2} wrapperClass="sm:col-span-2" />
          <Field name="city" label="Town or city" autoComplete="address-level2" defaultValue={d.city} />
          <Field name="postcode" label="Postcode" autoComplete="postal-code" defaultValue={d.postcode} />
          <div className="sm:col-span-2">
            <SubmitButton>Save details</SubmitButton>
          </div>
        </ActionForm>
      </div>

      <div className="card">
        <h2 className="mb-2 font-display text-2xl">Your calendar</h2>
        <p className="mb-3 text-sm text-muted">
          Subscribe in Google, Apple or Outlook calendar to see your appointments and any changes.
          Keep this link private.
        </p>
        <input className="input" readOnly value={calendar} aria-label="Calendar subscription link" />
      </div>

      <div className="card max-w-md">
        <h2 className="mb-4 font-display text-2xl">Password</h2>
        <ChangePasswordForm />
      </div>

      <div className="card space-y-4">
        <h2 className="font-display text-2xl">Your data</h2>
        <p className="text-sm text-muted">Download a copy of the information held about you.</p>
        <a download href="/api/account/export" className="btn btn-outline btn-sm">
          Download my data
        </a>
        {user.role !== "admin" && (
          <details>
            <summary className="cursor-pointer text-sm text-red-700">Delete my account</summary>
            <div className="mt-3 max-w-md">
              <p className="mb-3 text-sm text-muted">
                Your account, saved details and newsletter subscription are removed. Order, booking
                and payment records are kept for as long as the law requires. This cannot be undone.
              </p>
              <DeleteAccountForm />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
