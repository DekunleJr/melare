"use client";

/** [saved value, label] for each choice */
export type StatusOptions = readonly (readonly [string, string])[];

const ACTIVE_OR_ARCHIVED: StatusOptions = [
  ["active", "Active"],
  ["archived", "Archived"],
];

/**
 * A status choice that saves as soon as it is changed. Place inside an ActionForm.
 * A status that is not offered, such as a draft product, leaves every choice unselected.
 */
export function StatusRadios({
  status,
  label,
  options = ACTIVE_OR_ARCHIVED,
}: {
  status: string;
  label: string;
  options?: StatusOptions;
}) {
  return (
    // The key re-selects the saved value when the status changes by another route.
    <fieldset key={status} className="flex items-center gap-3">
      <legend className="sr-only">{label}</legend>
      {options.map(([value, text]) => (
        <label key={value} className="flex cursor-pointer items-center gap-1.5 text-xs">
          <input
            type="radio"
            name="status"
            value={value}
            defaultChecked={status === value}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="size-4 cursor-pointer accent-bronze"
          />
          {text}
        </label>
      ))}
    </fieldset>
  );
}
