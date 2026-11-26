import { CheckCircle2 } from "lucide-react";
import { ClearCart } from "./cart-ui";

/** Shown on the page a customer lands on straight after booking or ordering. */
export function NewNotice({
  kind,
  isNew,
  usedBag,
}: {
  kind: "booking" | "order";
  isNew: boolean;
  usedBag: boolean;
}) {
  if (!isNew) return null;
  return (
    <>
      {usedBag && <ClearCart />}
      <p role="status" className="mb-5 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <CheckCircle2 size={18} />
        Thank you. We have your {kind} and have emailed you the details.
      </p>
    </>
  );
}
