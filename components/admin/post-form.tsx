import { ActionForm, Field, Select, SubmitButton, TextArea } from "@/components/ui/form";
import type { posts } from "@/db/schema";
import { savePost } from "@/features/admin/commerce-actions";
import { FormatHelp } from "./format-help";

export function PostForm({ post }: { post?: typeof posts.$inferSelect }) {
  return (
    <ActionForm action={savePost.bind(null, post?.id ?? null)} className="card space-y-4">
      <Field name="title" label="Title" required defaultValue={post?.title} />
      <Field name="excerpt" label="Short summary" defaultValue={post?.excerpt} hint="Shown in the article list and in search results." />
      <TextArea name="body" label="Article" rows={18} required defaultValue={post?.body} />
      <FormatHelp />
      <Field name="cover" label={post?.coverImage ? "Replace cover photo" : "Cover photo"} type="file" accept="image/jpeg,image/png,image/webp,image/avif" />
      <Select name="status" label="Visibility" defaultValue={post?.status ?? "draft"}>
        <option value="draft">Draft (hidden)</option>
        <option value="published">Published</option>
      </Select>
      <SubmitButton>{post ? "Save article" : "Create article"}</SubmitButton>
    </ActionForm>
  );
}
