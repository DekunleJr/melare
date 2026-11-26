import { Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import type { FormAction, FormState } from "@/lib/forms";
import { StatusRadios, type StatusOptions } from "./status-radios";
import { IconLink } from "./ui";

/** The Action column of an admin list: a status switch, edit and delete. */
export function RowActions({
  name,
  status,
  statusOptions,
  editHref,
  statusAction,
  deleteAction,
  deleteNote,
}: {
  name: string;
  status: string;
  /** Defaults to Active / Archived */
  statusOptions?: StatusOptions;
  editHref: string;
  statusAction: FormAction;
  deleteAction: () => Promise<FormState>;
  /** What happens when the record cannot be removed completely */
  deleteNote?: string;
}) {
  return (
    <div className="flex items-center gap-4 whitespace-nowrap">
      <ActionForm action={statusAction} className="flex flex-col gap-1">
        <StatusRadios status={status} options={statusOptions} label={`Status of ${name}`} />
      </ActionForm>
      <IconLink href={editHref} label={`Edit ${name}`} />
      <ActionForm
        action={deleteAction}
        confirm={`Delete "${name}"? This cannot be undone. ${deleteNote ?? ""}`}
        className="flex flex-col items-start gap-1"
      >
        <SubmitButton className="btn btn-danger btn-sm" aria-label={`Delete ${name}`}>
          <Trash2 size={14} aria-hidden="true" />
          Delete
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
