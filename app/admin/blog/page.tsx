import { desc } from "drizzle-orm";
import Link from "next/link";
import { AdminHeader, Table } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/misc";
import { db } from "@/db";
import { posts } from "@/db/schema";
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
      <Table head={["Title", "Published", "Status"]} empty="No articles yet.">
        {rows.map((p) => (
          <tr key={p.id}>
            <td>
              <Link href={`/admin/blog/${p.id}`} prefetch={false} className="link">
                {p.title}
              </Link>
            </td>
            <td>{p.publishedAt ? formatShortDate(p.publishedAt) : "—"}</td>
            <td>
              <StatusBadge status={p.status} />
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
