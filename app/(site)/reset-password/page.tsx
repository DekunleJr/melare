import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/site/auth-forms";
import { AuthShell } from "@/components/site/auth-shell";

export const metadata: Metadata = { title: "New password", robots: { index: false } };

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <AuthShell title="Choose a new password">
      {searchParams.then(({ token, error }) =>
        typeof token === "string" && !error ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="text-center text-sm">
            This link is invalid or has expired.{" "}
            <Link href="/forgot-password" className="link">
              Request a new one
            </Link>
          </p>
        ),
      )}
    </AuthShell>
  );
}
