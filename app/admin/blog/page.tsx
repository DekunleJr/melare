import { desc } from "drizzle-orm";
import Link from "next/link";
import { RowActions } from "@/components/admin/row-actions";
import { AdminHeader, Table } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { deleteListedPost, setPostStatus } from "@/features/admin/commerce-actions";
import { requireAdmin } from "@/lib/session";
import { formatShortDate } from "@/lib/time";

export const metadata = { title: "Blog" };

export default async function BlogAdminPage() {
  await requireAdmin();
  const rows = await db.select().from(posts).orderBy(desc(posts.createdAt));
  return (
    <>
      <AdminHeader title="Blog">
        <Link href="/admin/blog/new" prefetch={false} className="btn btn-primary btn-sm">
          Write article
        </Link>
      </AdminHeader>
      <Table head={["Title", "Published", "Status", "Action"]} empty="No articles yet.">
        {rows.map((p) => (
          <tr key={p.id}>
            <td>{p.title}</td>
            <td>{p.publishedAt ? formatShortDate(p.publishedAt) : "—"}</td>
            <td>
              <StatusBadge status={p.status} />
            </td>
            <td>
              <RowActions
                name={p.title}
                status={p.status}
                statusOptions={[
                  ["published", "Published"],
                  ["draft", "Draft"],
                ]}
                editHref={`/admin/blog/${p.id}`}
                statusAction={setPostStatus.bind(null, p.id)}
                deleteAction={deleteListedPost.bind(null, p.id)}
              />
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
