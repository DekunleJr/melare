import Link from "next/link";
import type { ReactNode } from "react";
import { AdminHeader } from "@/components/admin/ui";
import { ActionForm, Checkbox, Field, SubmitButton, TextArea } from "@/components/ui/form";
import { Photo } from "@/components/ui/misc";
import { saveSettings } from "@/features/admin/content-actions";
import { requireAdmin } from "@/lib/session";
import { readSettings } from "@/lib/settings";

export const metadata = { title: "Settings" };

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="card grid gap-4 sm:grid-cols-2">
      <legend className="sr-only">{title}</legend>
      <h2 className="font-display text-2xl sm:col-span-2">{title}</h2>
      {children}
    </fieldset>
  );
}

export default async function SettingsPage() {
  await requireAdmin();
  const s = await readSettings();
  const wide = "sm:col-span-2";

  return (
    <div className="max-w-3xl">
      <AdminHeader title="Settings" />
      <ActionForm action={saveSettings} className="space-y-6">
        <Group title="Notifications">
          <Field name="contactEmail" label="Contact person's email" type="email" defaultValue={s.contactEmail} hint="Receives every new booking, product order and website message. Private." wrapperClass={wide} />
        </Group>
        <Group title="Business">
          <Field name="businessName" label="Business name" required defaultValue={s.businessName} />
          <Field name="tagline" label="Tagline" defaultValue={s.tagline} />
          <Field name="phone" label="Phone" defaultValue={s.phone} />
          <Field name="publicEmail" label="Public email" type="email" defaultValue={s.publicEmail} />
          <TextArea name="address" label="Address" rows={2} defaultValue={s.address} wrapperClass={wide} />
          <TextArea name="openingHours" label="Opening hours (shown on the site)" rows={7} defaultValue={s.openingHours} hint="Booking times come from each staff member's weekly hours." wrapperClass={wide} />
        </Group>
        <Group title="Website content">
          <Field name="announcement" label="Announcement banner" defaultValue={s.announcement} hint="Leave empty to hide." wrapperClass={wide} />
          <Field name="heroTitle" label="Home page headline" required defaultValue={s.heroTitle} wrapperClass={wide} />
          <TextArea name="heroSubtitle" label="Home page introduction" rows={2} defaultValue={s.heroSubtitle} wrapperClass={wide} />
          {s.heroImage && <Photo src={s.heroImage} alt="Current home page photo" className={`aspect-[3/2] max-w-xs rounded-xl ${wide}`} sizes="320px" />}
          <Field name="heroImage" label="Home page photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif" wrapperClass={wide} />
          <TextArea name="aboutText" label="About us" rows={6} defaultValue={s.aboutText} wrapperClass={wide} />
        </Group>
        <Group title="Social">
          <Field name="whatsapp" label="WhatsApp number" defaultValue={s.whatsapp} hint="With country code, e.g. 447700900000" />
          <Field name="instagram" label="Instagram" defaultValue={s.instagram} />
          <Field name="facebook" label="Facebook" defaultValue={s.facebook} />
          <Field name="tiktok" label="TikTok" defaultValue={s.tiktok} />
        </Group>
        <Group title="Shop collection">
          <div className={wide}>
            <Checkbox name="pickupEnabled" label="Customers can collect orders from the salon" defaultChecked={Boolean(s.pickupEnabled)} />
          </div>
          <TextArea name="pickupInstructions" label="Collection instructions" rows={2} defaultValue={s.pickupInstructions} wrapperClass={wide} />
          <p className="text-sm text-muted sm:col-span-2">
            Delivery prices are under <Link href="/admin/delivery" prefetch={false} className="link">Delivery</Link>.
          </p>
        </Group>
        <Group title="Mobile visits and approval">
          <div className="space-y-2 sm:col-span-2">
            <Checkbox name="mobileEnabled" label="Offer mobile (home) appointments" defaultChecked={Boolean(s.mobileEnabled)} />
            <Checkbox name="mobileNeedsApproval" label="I approve every mobile booking before the customer pays" defaultChecked={Boolean(s.mobileNeedsApproval)} />
          </div>
          <Field name="approvalHoldHours" label="Hold a request for (hours)" type="number" min={1} required defaultValue={s.approvalHoldHours} hint="It expires if you have not replied." />
          <Field name="paymentLinkHours" label="Time to pay after approval (hours)" type="number" min={1} required defaultValue={s.paymentLinkHours} />
          <p className="text-sm text-muted sm:col-span-2">
            Postcodes and travel fees are under <Link href="/admin/areas" prefetch={false} className="link">Mobile areas</Link>.
          </p>
        </Group>
        <Group title="Marketing, statistics and backups">
          <Field name="gaMeasurementId" label="Google Analytics measurement ID" defaultValue={s.gaMeasurementId} placeholder="G-XXXXXXXXXX" hint="Leave empty to switch off. Only used for visitors who accept cookies." />
          <Field name="abandonedCartHours" label="Basket reminder after (hours)" type="number" min={0} required defaultValue={s.abandonedCartHours} hint="Only for shoppers who ask. 0 switches it off." />
          <Field name="backupKeep" label="Backups to keep" type="number" min={1} required defaultValue={s.backupKeep} />
        </Group>
        <Group title="Booking rules">
          <Field name="bookingLeadHours" label="Minimum notice to book (hours)" type="number" min={0} required defaultValue={s.bookingLeadHours} />
          <Field name="bookingHorizonDays" label="Book up to (days ahead)" type="number" min={1} required defaultValue={s.bookingHorizonDays} />
          <Field name="slotIntervalMinutes" label="Start times every (minutes)" type="number" min={5} step={5} required defaultValue={s.slotIntervalMinutes} />
          <Field name="cancellationNoticeHours" label="Online changes close (hours before)" type="number" min={0} required defaultValue={s.cancellationNoticeHours} />
          <TextArea name="cancellationPolicy" label="Cancellation policy" rows={3} defaultValue={s.cancellationPolicy} wrapperClass={wide} />
        </Group>
        <SubmitButton>Save settings</SubmitButton>
      </ActionForm>
    </div>
  );
}
