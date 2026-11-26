import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/components/site/auth-forms";
import { AuthShell } from "@/components/site/auth-shell";
import { safeNext } from "@/lib/redirects";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <AuthShell title="Welcome back">
      {searchParams.then(({ next, reset }) => (
        <>
          {reset && (
            <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Password updated. Please sign in.
            </p>
          )}
          <SignInForm next={safeNext(next)} />
          <p className="mt-5 text-center text-sm">
            New here?{" "}
            <Link href={`/sign-up?next=${encodeURIComponent(safeNext(next))}`} className="link">
              Create an account
            </Link>
          </p>
          <p className="mt-2 text-center text-xs text-muted">
            An account is optional. You can book and shop as a guest.
          </p>
        </>
      ))}
    </AuthShell>
  );
}
