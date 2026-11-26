import { desc } from "drizzle-orm";
import { ActionButton, AdminHeader, PAGE_SIZE, Pagination, queryPage, Table } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import { emailLog } from "@/db/schema";
import { retryEmail } from "@/features/admin/content-actions";
import { requireAdmin } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Email log" };

export default async function EmailsPage({ searchParams }: PageProps<"/admin/emails">) {
  await requireAdmin();
  const page = queryPage((await searchParams).page);
  const rows = await db
    .select()
    .from(emailLog)
    .orderBy(desc(emailLog.id))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <>
      <AdminHeader title="Email log" />
      <Table head={["When", "To", "Subject", "Status", ""]} empty="No emails yet.">
        {rows.slice(0, PAGE_SIZE).map((m) => (
          <tr key={m.id}>
            <td className="whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
            <td>{m.toAddress}</td>
            <td>
              {m.html ? (
                <details>
                  <summary className="cursor-pointer">{m.subject}</summary>
                  <pre className="mt-2 max-w-xl font-sans text-xs whitespace-pre-wrap text-muted">{m.text}</pre>
                </details>
              ) : (
                m.subject
              )}
              {m.error && <p className="text-xs text-red-700">{m.error}</p>}
            </td>
            <td>
              <StatusBadge status={m.status} />
            </td>
            <td>
              {m.html && (
                <ActionButton action={retryEmail.bind(null, m.id)} confirm={`Send this email to ${m.toAddress} again?`}>
                  Resend
                </ActionButton>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <Pagination base="/admin/emails" page={page} hasMore={rows.length > PAGE_SIZE} />
    </>
  );
}
