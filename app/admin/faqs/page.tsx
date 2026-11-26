import { asc } from "drizzle-orm";
import { ActionButton, AdminHeader } from "@/components/admin/ui";
import { ActionForm, Checkbox, Field, SubmitButton, TextArea } from "@/components/ui/form";
import { db } from "@/db";
import { faqs } from "@/db/schema";
import { deleteFaq, saveFaq } from "@/features/admin/content-actions";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "FAQs" };

function FaqForm({ faq }: { faq?: typeof faqs.$inferSelect }) {
  return (
    <ActionForm action={saveFaq.bind(null, faq?.id ?? null)} resetOnSuccess={!faq} className="space-y-3">
      <Field name="question" label="Question" required defaultValue={faq?.question} />
      <TextArea name="answer" label="Answer" required defaultValue={faq?.answer} />
      <div className="flex flex-wrap items-end gap-4">
        <Field name="sortOrder" label="Order" type="number" min={0} defaultValue={faq?.sortOrder ?? 0} wrapperClass="w-24" />
        <div className="pb-3">
          <Checkbox name="published" label="Published" defaultChecked={faq?.published ?? true} />
        </div>
        <SubmitButton>{faq ? "Save" : "Add question"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function FaqsAdminPage() {
  await requireAdmin();
  const rows = await db.select().from(faqs).orderBy(asc(faqs.sortOrder), asc(faqs.id));
  return (
    <div className="max-w-3xl space-y-4">
      <AdminHeader title="FAQs" />
      <div className="card">
        <FaqForm />
      </div>
      {rows.map((faq) => (
        <div key={faq.id} className="card space-y-3">
          <FaqForm faq={faq} />
          <ActionButton action={deleteFaq.bind(null, faq.id)} confirm="Delete this question?" danger>
            Delete
          </ActionButton>
        </div>
      ))}
    </div>
  );
}
