import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormatHelp } from "@/components/admin/format-help";
import { ActionButton, AdminHeader } from "@/components/admin/ui";
import { ActionForm, Field, SubmitButton, TextArea } from "@/components/ui/form";
import { db } from "@/db";
import { contentPages } from "@/db/schema";
import { resetPage, savePage } from "@/features/admin/commerce-actions";
import { defaultPages, PAGE_SLUGS, type PageSlug } from "@/lib/default-pages";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Edit page" };

export default async function EditPage({ params }: PageProps<"/admin/pages/[slug]">) {
  await requireAdmin();
  const slug = (await params).slug as PageSlug;
  if (!PAGE_SLUGS.includes(slug)) notFound();
  const [saved] = await db.select().from(contentPages).where(eq(contentPages.slug, slug));
  const page = saved ?? defaultPages[slug];

  return (
    <div className="max-w-3xl space-y-4">
      <AdminHeader title={page.title}>
        <Link href={`/${slug}`} prefetch={false} className="btn btn-outline btn-sm">
          View page
        </Link>
        {saved && (
          <ActionButton action={resetPage.bind(null, slug)} confirm="Replace your text with the starting text?" danger>
            Restore starting text
          </ActionButton>
        )}
      </AdminHeader>
      <p className="text-sm text-muted">
        Words in braces, such as {"{businessName}"}, {"{address}"}, {"{cancellationPolicy}"} or{" "}
        {"{cancellationNoticeHours}"}, are filled in from Settings.
      </p>
      <ActionForm key={slug} action={savePage.bind(null, slug)} className="card space-y-4">
        <Field name="title" label="Title" required defaultValue={page.title} />
        <TextArea name="body" label="Text" rows={22} required defaultValue={page.body} />
        <FormatHelp />
        <SubmitButton>Save page</SubmitButton>
      </ActionForm>
    </div>
  );
}
