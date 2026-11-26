import Link from "next/link";
import { AdminHeader, Table } from "@/components/admin/ui";
import { db } from "@/db";
import { contentPages } from "@/db/schema";
import { defaultPages, PAGE_SLUGS } from "@/lib/default-pages";
import { requireAdmin } from "@/lib/session";
import { formatShortDate } from "@/lib/time";

export const metadata = { title: "Pages" };

export default async function PagesPage() {
  await requireAdmin();
  const saved = await db.select().from(contentPages);
  return (
    <div className="max-w-3xl">
      <AdminHeader title="Policy and information pages" />
      <Table head={["Page", "Address", "Last edited"]} empty="">
        {PAGE_SLUGS.map((slug) => {
          const page = saved.find((p) => p.slug === slug);
          return (
            <tr key={slug}>
              <td>
                <Link href={`/admin/pages/${slug}`} prefetch={false} className="link">
                  {page?.title ?? defaultPages[slug].title}
                </Link>
              </td>
              <td>/{slug}</td>
              <td>{page ? formatShortDate(page.updatedAt) : "Starting text"}</td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
