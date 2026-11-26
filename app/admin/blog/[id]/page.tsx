import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostForm } from "@/components/admin/post-form";
import { ActionButton, AdminHeader, Created, BackButton } from "@/components/admin/ui";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { deletePost } from "@/features/admin/commerce-actions";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Edit article" };

export default async function EditPostPage({ params, searchParams }: PageProps<"/admin/blog/[id]">) {
  await requireAdmin();
  const id = Number((await params).id) || 0;
  const [post] = await db.select().from(posts).where(eq(posts.id, id));
  if (!post) notFound();
  return (
    <>
      {/* Outside the narrow column, so the buttons sit at the right edge of the page. */}
      <AdminHeader title={post.title}>
        {post.status === "published" && (
          <Link href={`/blog/${post.slug}`} prefetch={false} className="btn btn-outline btn-sm">
            View article
          </Link>
        )}
        <ActionButton action={deletePost.bind(null, id)} confirm="Delete this article?" danger>
          Delete
        </ActionButton>
        <BackButton href="/admin/blog" />
      </AdminHeader>
      <div className="max-w-3xl space-y-4">
        <Created show={(await searchParams).created} />
        <PostForm post={post} />
      </div>
    </>
  );
}
