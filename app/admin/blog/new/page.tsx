import { PostForm } from "@/components/admin/post-form";
import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Write article" };

export default async function NewPostPage() {
  await requireAdmin();
  return (
    <div className="max-w-3xl">
      <AdminHeader title="Write article" />
      <PostForm />
    </div>
  );
}
