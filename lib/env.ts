import "server-only";

/** Read lazily so a missing optional service never breaks unrelated pages. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value;
}

const optional = (name: string) => process.env[name] || "";

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get siteUrl() {
    return (optional("NEXT_PUBLIC_SITE_URL") || "http://localhost:3000").replace(/\/$/, "");
  },
  get authSecret() {
    const secret = required("BETTER_AUTH_SECRET");
    if (secret.length < 32) {
      throw new Error("BETTER_AUTH_SECRET must be at least 32 characters.");
    }
    return secret;
  },
  get cronSecret() {
    return optional("CRON_SECRET");
  },
  get paypal() {
    const mode = optional("PAYPAL_ENV") === "live" ? ("live" as const) : ("sandbox" as const);
    return {
      mode,
      clientId: optional("PAYPAL_CLIENT_ID"),
      clientSecret: optional("PAYPAL_CLIENT_SECRET"),
      webhookId: optional("PAYPAL_WEBHOOK_ID"),
      // The two overrides exist only so tests can use a local stand-in for PayPal.
      apiBase:
        optional("PAYPAL_API_BASE") ||
        (mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com"),
      sdkUrl: optional("PAYPAL_SDK_URL") || "https://www.paypal.com/sdk/js",
    };
  },
  get resendApiKey() {
    return optional("RESEND_API_KEY");
  },
  /** Resend segment that newsletter subscribers are copied into */
  get resendSegmentId() {
    return optional("RESEND_SEGMENT_ID");
  },
  get emailFrom() {
    return optional("EMAIL_FROM") || "MelareBeauty <onboarding@resend.dev>";
  },
  get contactEmail() {
    return optional("CONTACT_EMAIL");
  },
  get mysqldumpPath() {
    return optional("MYSQLDUMP_PATH");
  },
  get schedulerDisabled() {
    return optional("DISABLE_SCHEDULER") === "1";
  },
};
