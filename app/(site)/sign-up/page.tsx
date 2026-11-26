import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/site/auth-forms";
import { AuthShell } from "@/components/site/auth-shell";
import { safeNext } from "@/lib/redirects";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <AuthShell title="Create your account">
      {searchParams.then(({ next }) => (
        <>
          <SignUpForm next={safeNext(next)} />
          <p className="mt-5 text-center text-sm">
            Already registered?{" "}
            <Link href={`/sign-in?next=${encodeURIComponent(safeNext(next))}`} className="link">
              Sign in
            </Link>
          </p>
        </>
      ))}
    </AuthShell>
  );
}
