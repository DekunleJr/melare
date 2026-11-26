"use client";

import {
  createContext,
  startTransition,
  use,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import type { FormAction, FormState } from "@/lib/forms";

/** Slightly under serverActions.bodySizeLimit in next.config.ts */
const MAX_UPLOAD_TOTAL = 5.5 * 1024 * 1024;

const FormContext = createContext<{ state: FormState; pending: boolean }>({
  state: {},
  pending: false,
});

export function ActionForm({
  action,
  children,
  className = "space-y-4",
  resetOnSuccess = false,
  confirm,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  /** Ask before submitting destructive actions */
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [tooLarge, setTooLarge] = useState(false);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.url) {
      // Coming back with the browser's back button must not leave the form stuck.
      const restore = (event: PageTransitionEvent) => {
        if (event.persisted) window.location.reload();
      };
      window.addEventListener("pageshow", restore);
      window.location.assign(state.url);
      return () => window.removeEventListener("pageshow", restore);
    }
    if (state.ok && resetOnSuccess) ref.current?.reset();
    else if (state.ok) {
      // Otherwise saving again would upload the same files twice.
      ref.current
        ?.querySelectorAll<HTMLInputElement>("input[type=file]")
        .forEach((input) => (input.value = ""));
    }
  }, [state, resetOnSuccess]);

  return (
    <FormContext value={{ state, pending: pending || Boolean(state.url) }}>
      <form
        ref={ref}
        action={formAction}
        className={className}
        onSubmit={(event) => {
          // Dispatching ourselves keeps typed values when validation fails.
          event.preventDefault();
          if (confirm && !window.confirm(confirm)) return;
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          const data = new FormData(event.currentTarget, submitter);
          // The server refuses bigger requests outright, so catch them here.
          let bytes = 0;
          for (const value of data.values()) if (value instanceof File) bytes += value.size;
          setTooLarge(bytes > MAX_UPLOAD_TOTAL);
          if (bytes > MAX_UPLOAD_TOTAL) return;
          startTransition(() => formAction(data));
        }}
      >
        {children}
        {tooLarge && (
          <p role="alert" className="col-span-full rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            Those images are too large. Upload up to 5 MB at a time.
          </p>
        )}
        {state.message && !tooLarge && (
          <p
            role={state.ok ? "status" : "alert"}
            className={`col-span-full rounded-lg px-4 py-3 text-sm ${state.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}
          >
            {state.message}
          </p>
        )}
      </form>
    </FormContext>
  );
}

export function SubmitButton({
  children,
  className = "btn btn-primary",
  disabled,
  ...props
}: ComponentProps<"button">) {
  const { pending } = use(FormContext);
  return (
    <button type="submit" className={className} disabled={pending || disabled} {...props}>
      {pending ? "Please wait…" : children}
    </button>
  );
}

function useFieldError(name: string) {
  return use(FormContext).state.errors?.[name];
}

function Wrapper({
  name,
  label,
  hint,
  className = "",
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  className?: string;
  /** Receives the attributes that tie the control to its label and hint */
  children: (control: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid": boolean;
  }) => ReactNode;
}) {
  const error = useFieldError(name);
  const id = useId();
  const note = error || hint;
  const noteId = `${id}-note`;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      {children({
        id,
        "aria-describedby": note ? noteId : undefined,
        "aria-invalid": Boolean(error),
      })}
      {note && (
        <span id={noteId} className={`mt-1 block ${error ? "text-sm text-red-700" : "text-xs text-muted"}`}>
          {note}
        </span>
      )}
    </div>
  );
}

type Extra = { label: string; hint?: string; wrapperClass?: string };

export function Field({
  label,
  hint,
  wrapperClass,
  ...props
}: ComponentProps<"input"> & Extra & { name: string }) {
  return (
    <Wrapper name={props.name} label={label} hint={hint} className={wrapperClass}>
      {(control) => <input className="input" {...props} {...control} />}
    </Wrapper>
  );
}

export function TextArea({
  label,
  hint,
  wrapperClass,
  ...props
}: ComponentProps<"textarea"> & Extra & { name: string }) {
  return (
    <Wrapper name={props.name} label={label} hint={hint} className={wrapperClass}>
      {(control) => <textarea className="input" rows={4} {...props} {...control} />}
    </Wrapper>
  );
}

export function Select({
  label,
  hint,
  wrapperClass,
  children,
  ...props
}: ComponentProps<"select"> & Extra & { name: string }) {
  return (
    <Wrapper name={props.name} label={label} hint={hint} className={wrapperClass}>
      {(control) => (
        <select className="input" {...props} {...control}>
          {children}
        </select>
      )}
    </Wrapper>
  );
}

export function Checkbox({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 accent-clay" {...props} />
      {label}
    </label>
  );
}

/** Hidden field that only bots fill in. */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px]">
      <label>
        Leave this empty
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}
