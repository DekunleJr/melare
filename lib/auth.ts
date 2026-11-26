import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { notifyWelcome } from "@/features/notifications";
import { sendEmail } from "./email/send";
import { renderEmail } from "./email/templates";
import { env } from "./env";
import { readSettings } from "./settings";

function createAuth() {
  return betterAuth({
    baseURL: env.siteUrl,
    secret: env.authSecret,
    database: drizzleAdapter(db, {
      provider: "mysql",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    user: {
      additionalFields: {
        // input: false stops anyone choosing their own role at sign-up.
        role: { type: "string", defaultValue: "customer", input: false },
        disabled: { type: "boolean", defaultValue: false, input: false },
      },
      deleteUser: {
        enabled: true,
        beforeDelete: async (account) => {
          const [row] = await db
            .select({ role: schema.user.role })
            .from(schema.user)
            .where(eq(schema.user.id, account.id));
          if (row?.role === "admin") {
            throw new APIError("BAD_REQUEST", {
              message: "Administrator accounts cannot be deleted here.",
            });
          }
          // Order and booking records are kept for accounting, no longer linked to
          // the account. Everything else about the person is removed.
          await db
            .update(schema.reviews)
            .set({ authorName: "Former customer", userId: null })
            .where(eq(schema.reviews.userId, account.id));
          await db.delete(schema.savedCarts).where(eq(schema.savedCarts.email, account.email));
          await db.delete(schema.subscribers).where(eq(schema.subscribers.email, account.email));
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const settings = await readSettings();
        // Not awaited, so response time does not reveal whether the account exists.
        void sendEmail({
          to: user.email,
          kind: "password_reset",
          subject: `Reset your ${settings.businessName} password`,
          sensitive: true,
          ...renderEmail({
            businessName: settings.businessName,
            heading: "Reset your password",
            paragraphs: [
              `Hello ${user.name},`,
              "Use the button below to choose a new password. The link expires in one hour.",
            ],
            button: { label: "Choose a new password", url },
            footer: "If you did not ask for this, you can safely ignore this email.",
          }),
        });
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (account) => {
            // The command that creates administrators exits at once and needs no welcome.
            if (process.env.MELARE_NO_WELCOME === "1") return;
            // Not awaited: signing up must not wait for email.
            void notifyWelcome(account.email, account.name).catch((error) =>
              console.error("Welcome email failed", error),
            );
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const [row] = await db
              .select({ disabled: schema.user.disabled })
              .from(schema.user)
              .where(eq(schema.user.id, session.userId));
            if (row?.disabled) return false;
          },
        },
      },
    },
    rateLimit: { enabled: true },
    // Must stay last so cookies set by server actions are applied.
    plugins: [nextCookies()],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/** Created on first use, so importing this module never requires secrets at build time. */
export function getAuth() {
  return (instance ??= createAuth());
}
