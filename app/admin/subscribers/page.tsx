import { desc } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { ActionButton, AdminHeader, PAGE_SIZE, Pagination, queryPage, Table } from "@/components/admin/ui";
import { db } from "@/db";
import { subscribers } from "@/db/schema";
import { syncSubscribers } from "@/features/admin/commerce-actions";
import { removeSubscriber } from "@/features/admin/content-actions";
import { isMarketingSyncConfigured } from "@/features/marketing";
import { requireAdmin } from "@/lib/session";
import { formatShortDate } from "@/lib/time";

export const metadata = { title: "Subscribers" };

export default async function SubscribersPage({ searchParams }: PageProps<"/admin/subscribers">) {
  await requireAdmin();
  const page = queryPage((await searchParams).page);
  const rows = await db
    .select()
    .from(subscribers)
    .orderBy(desc(subscribers.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <div className="max-w-3xl">
      <AdminHeader title="Newsletter subscribers">
        <a download href="/api/admin/export/subscribers" className="btn btn-outline btn-sm">
          Download CSV
        </a>
        {isMarketingSyncConfigured() && (
          <ActionButton action={syncSubscribers}>Send all to Resend</ActionButton>
        )}
      </AdminHeader>
      <p className="mb-4 text-sm text-muted">
        {isMarketingSyncConfigured()
          ? "New subscribers are added to your Resend segment. Write and send campaigns in Resend under Broadcasts."
          : "To send campaigns, set RESEND_SEGMENT_ID so subscribers are copied into Resend (see the README), or import the CSV into your email tool."}
      </p>
      <Table head={["Email", "Joined", "Action"]} empty="No subscribers yet.">
        {rows.slice(0, PAGE_SIZE).map((s) => (
          <tr key={s.id}>
            <td>{s.email}</td>
            <td>{formatShortDate(s.createdAt)}</td>
            <td>
              <ActionButton action={removeSubscriber.bind(null, s.id)} confirm="Remove this subscriber?" danger>
                <Trash2 size={14} aria-hidden="true" />
                Delete
              </ActionButton>
            </td>
          </tr>
        ))}
      </Table>
      <Pagination base="/admin/subscribers" page={page} hasMore={rows.length > PAGE_SIZE} />
    </div>
  );
}
