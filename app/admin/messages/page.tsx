import { desc } from "drizzle-orm";
import { ActionButton, AdminHeader, PAGE_SIZE, Pagination, queryPage } from "@/components/admin/ui";
import { EmptyState, StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { setMessageStatus } from "@/features/admin/content-actions";
import { requireAdmin } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  await requireAdmin();
  const page = queryPage((await searchParams).page);
  const rows = await db
    .select()
    .from(contactMessages)
    .orderBy(desc(contactMessages.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <div className="max-w-3xl space-y-4">
      <AdminHeader title="Messages" />
      {!rows.length && <EmptyState title="No messages" />}
      {rows.slice(0, PAGE_SIZE).map((m) => (
        <article key={m.id} className={`card space-y-3 ${m.status === "archived" ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{m.subject}</h2>
            <StatusBadge status={m.status} />
          </div>
          <p className="text-sm text-muted">
            {m.name} ·{" "}
            <a className="link" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}>
              {m.email}
            </a>
            {m.phone && ` · ${m.phone}`} · {formatDateTime(m.createdAt)}
          </p>
          <p className="text-sm whitespace-pre-line">{m.message}</p>
          <div className="flex flex-wrap gap-2">
            {m.status === "new" ? (
              <ActionButton action={setMessageStatus.bind(null, m.id, "read")}>Mark read</ActionButton>
            ) : (
              <ActionButton action={setMessageStatus.bind(null, m.id, "new")}>Mark unread</ActionButton>
            )}
            {m.status !== "archived" && (
              <ActionButton action={setMessageStatus.bind(null, m.id, "archived")}>Archive</ActionButton>
            )}
            <ActionButton action={setMessageStatus.bind(null, m.id, "delete")} confirm="Delete this message?" danger>
              Delete
            </ActionButton>
          </div>
        </article>
      ))}
      <Pagination base="/admin/messages" page={page} hasMore={rows.length > PAGE_SIZE} />
    </div>
  );
}
