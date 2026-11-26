"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

type Result = { error?: { message?: string; status?: number } | null };

function AuthForm({
  submitLabel,
  onSubmit,
  children,
}: {
  submitLabel: string;
  /** Returns the text to show on success, or navigates away */
  onSubmit: (data: Record<string, string>) => Promise<{ result: Result; success?: string }>;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    setPending(true);
    setMessage(null);
    try {
      const { result, success } = await onSubmit(data);
      if (result.error) {
        setMessage({
          ok: false,
          text:
            result.error.status === 429
              ? "Too many attempts. Please wait a minute and try again."
              : result.error.message || "Something went wrong. Please try again.",
        });
        setPending(false);
      } else if (success) {
        setMessage({ ok: true, text: success });
        setPending(false);
      }
    } catch {
      setMessage({ ok: false, text: "Could not reach the server. Please try again." });
      setPending(false);
    }
  }

  return (
    // method="post" keeps credentials out of the URL if scripts have not loaded yet.
    <form method="post" onSubmit={handle} className="space-y-4">
      {children}
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`rounded-lg px-4 py-3 text-sm ${message.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}
        >
          {message.text}
        </p>
      )}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}

type InputProps = { label: string } & ComponentProps<"input">;

function Input({ label, ...props }: InputProps) {
  if (props.type === "password") return <PasswordInput label={label} {...props} />;
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" required {...props} />
    </label>
  );
}

/** A password field with an eye button to show or hide what has been typed. */
function PasswordInput({ label, ...props }: InputProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const Icon = visible ? EyeOff : Eye;
  return (
    // The button sits outside the <label> so it is not read as part of the field's name.
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          className="input pr-12"
          required
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          // Keep a visible password away from autocorrect and spell checkers.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 grid w-11 cursor-pointer place-items-center rounded-r-lg text-muted hover:text-ink"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-controls={id}
          onClick={() => setVisible(!visible)}
        >
          <Icon size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// A full page load picks up the new session everywhere.
const go = (url: string) => window.location.assign(url);

export function SignInForm({ next }: { next: string }) {
  return (
    <AuthForm
      submitLabel="Sign in"
      onSubmit={async ({ email, password }) => {
        const result = await authClient.signIn.email({ email, password });
        if (!result.error) go(next);
        return { result };
      }}
    >
      <Input label="Email" name="email" type="email" autoComplete="email" />
      <Input label="Password" name="password" type="password" autoComplete="current-password" />
      <p className="text-right text-sm">
        <Link href="/forgot-password" className="link">
          Forgot password?
        </Link>
      </p>
    </AuthForm>
  );
}

export function SignUpForm({ next }: { next: string }) {
  return (
    <AuthForm
      submitLabel="Create account"
      onSubmit={async ({ name, email, password }) => {
        const result = await authClient.signUp.email({ name: name.trim(), email, password });
        if (!result.error) go(next);
        return { result };
      }}
    >
      <Input label="Full name" name="name" autoComplete="name" maxLength={120} />
      <Input label="Email" name="email" type="email" autoComplete="email" />
      <Input label="Password" name="password" type="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" />
    </AuthForm>
  );
}

export function ForgotPasswordForm() {
  return (
    <AuthForm
      submitLabel="Send reset link"
      onSubmit={async ({ email }) => ({
        result: await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" }),
        success: "If that address has an account, a reset link is on its way.",
      })}
    >
      <Input label="Email" name="email" type="email" autoComplete="email" />
    </AuthForm>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  return (
    <AuthForm
      submitLabel="Save new password"
      onSubmit={async ({ password }) => {
        const result = await authClient.resetPassword({ newPassword: password, token });
        if (!result.error) go("/sign-in?reset=1");
        return { result };
      }}
    >
      <Input label="New password" name="password" type="password" autoComplete="new-password" minLength={8} />
    </AuthForm>
  );
}

export function ChangePasswordForm() {
  return (
    <AuthForm
      submitLabel="Change password"
      onSubmit={async ({ currentPassword, newPassword }) => ({
        result: await authClient.changePassword({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        }),
        success: "Your password has been changed.",
      })}
    >
      <Input label="Current password" name="currentPassword" type="password" autoComplete="current-password" />
      <Input label="New password" name="newPassword" type="password" autoComplete="new-password" minLength={8} />
    </AuthForm>
  );
}

export function DeleteAccountForm() {
  return (
    <AuthForm
      submitLabel="Permanently delete my account"
      onSubmit={async ({ password }) => {
        if (!window.confirm("Delete your account for good?")) return { result: {} };
        const result = await authClient.deleteUser({ password });
        if (!result.error) go("/");
        return { result };
      }}
    >
      <Input label="Your password" name="password" type="password" autoComplete="current-password" />
    </AuthForm>
  );
}

export function SignOutButton({ className = "btn btn-outline btn-sm" }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await authClient.signOut();
        go("/");
      }}
    >
      Sign out
    </button>
  );
}
