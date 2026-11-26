import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/site/auth-forms";
import { AuthShell } from "@/components/site/auth-shell";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
