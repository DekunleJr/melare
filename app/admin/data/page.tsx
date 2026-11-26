import { connection } from "next/server";
import { ActionButton, AdminHeader, Table } from "@/components/admin/ui";
import { backupNow, resetCalendarLinks } from "@/features/admin/commerce-actions";
import { listBackups } from "@/lib/backup";
import { env } from "@/lib/env";
import { requireAdmin } from "@/lib/session";
import { readSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { feedToken } from "@/lib/tokens";

export const metadata = { title: "Backups and exports" };

export default async function DataPage() {
  await connection();
  await requireAdmin();
  const [backups, settings] = await Promise.all([listBackups(), readSettings()]);
  const feed = `${env.siteUrl}/api/calendar/${feedToken("admin", "all", settings.calendarNonce)}.ics`;
  const twoDaysAgo = new Date().getTime() - 2 * 86_400_000;
  const stale = !backups[0] || backups[0].createdAt.getTime() < twoDaysAgo;

  return (
    <div className="max-w-3xl space-y-8">
      <AdminHeader title="Backups, exports and calendar" />

      <section className="card">
        <h2 className="font-display text-2xl">Export your data</h2>
        <p className="mb-4 text-sm text-muted">
          Spreadsheet files (CSV). They contain personal data: store and share them carefully.
        </p>
        <div className="flex flex-wrap gap-3">
          {["customers", "orders", "bookings", "payments", "subscribers"].map((kind) => (
            <a key={kind} download href={`/api/admin/export/${kind}`} className="btn btn-outline btn-sm capitalize">
              {kind}
            </a>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Backups</h2>
          <ActionButton action={backupNow}>Back up now</ActionButton>
        </div>
        <p className="text-sm text-muted">
          A backup is made every day while the website is running, and the newest{" "}
          {settings.backupKeep} are kept in the <code>backups</code> folder, together with your
          uploaded photos. They are on the same server as the website: download or copy them
          somewhere else regularly.
        </p>
        {stale && (
          <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            There is no backup from the last two days.
          </p>
        )}
        <Table head={["Made", "Folder", "Database size", ""]} empty="No backups yet.">
          {backups.map((b) => (
            <tr key={b.name}>
              <td>{formatDateTime(b.createdAt)}</td>
              <td>
                <code>{b.name}</code>
              </td>
              <td>{Math.ceil(b.databaseBytes / 1024)} KB</td>
              <td>
                <a download href={`/api/admin/backups/${b.name}`} className="link">
                  Download
                </a>
              </td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-2xl">Salon calendar</h2>
        <p className="text-sm text-muted">
          Subscribe to this address in Google, Apple or Outlook calendar to see every booking and
          request. Changes appear automatically, usually within a few hours. It is one way: events
          you add to your own calendar do not block times on the website (use Staff &gt; Time off).
          Each staff member also has their own link on their profile.
        </p>
        <input className="input" readOnly value={feed} aria-label="Salon calendar link" />
        <ActionButton action={resetCalendarLinks} confirm="Replace the salon and staff calendar links? The old ones stop working." danger>
          Replace links
        </ActionButton>
      </section>
    </div>
  );
}
