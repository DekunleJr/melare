import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import { emailLog } from "@/db/schema";
import { env } from "@/lib/env";

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  kind: string;
  replyTo?: string;
  /** Calendar invite attached as appointment.ics */
  ics?: string;
  /** Bodies containing one-time secrets are never written to the database */
  sensitive?: boolean;
};

let client: Resend | null = null;

function getClient() {
  if (!env.resendApiKey) return null;
  return (client ??= new Resend(env.resendApiKey));
}

type Outcome = { status: "sent" | "logged" | "failed"; error?: string };

const MAX_ATTEMPTS = 4;

async function transmit(email: Email): Promise<Outcome> {
  const resend = getClient();
  if (!resend) {
    if (process.env.NODE_ENV === "production") {
      return { status: "failed", error: "RESEND_API_KEY is not set." };
    }
    console.log(`\n--- Email (not sent, no RESEND_API_KEY) ---\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n---\n`);
    return { status: "logged" };
  }

  // The same key on every attempt means a retry can never deliver twice.
  const idempotencyKey = randomUUID();
  try {
    for (let attempt = 1; ; attempt++) {
      // Resend reports API problems in `error` rather than throwing.
      const { error } = await resend.emails.send(
        {
          from: env.emailFrom,
          to: email.to,
          replyTo: email.replyTo,
          subject: email.subject.replace(/[\r\n]+/g, " "),
          html: email.html,
          text: email.text,
          attachments: email.ics
            ? [
                {
                  filename: "appointment.ics",
                  content: Buffer.from(email.ics),
                  contentType: "text/calendar",
                },
              ]
            : undefined,
        },
        { idempotencyKey },
      );
      if (!error) return { status: "sent" };
      if (error.name !== "rate_limit_exceeded" || attempt >= MAX_ATTEMPTS) {
        return { status: "failed", error: `${error.name}: ${error.message}` };
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}

/** Record and deliver one email. Never throws: a mail problem must not break a sale. */
export async function sendEmail(email: Email): Promise<Outcome> {
  try {
    const [{ id }] = await db
      .insert(emailLog)
      .values({
        toAddress: email.to,
        replyTo: email.replyTo ?? null,
        subject: email.subject.slice(0, 255),
        html: email.sensitive ? "" : email.html,
        text: email.sensitive ? "" : email.text,
        ics: email.ics ?? null,
        kind: email.kind,
      })
      .$returningId();
    const outcome = await transmit(email);
    await db
      .update(emailLog)
      .set({
        status: outcome.status,
        error: outcome.error ?? null,
        sentAt: outcome.status === "sent" ? new Date() : null,
      })
      .where(eq(emailLog.id, id));
    if (outcome.status === "failed") console.error(`Email "${email.kind}" failed: ${outcome.error}`);
    return outcome;
  } catch (error) {
    console.error("Email could not be recorded or sent", error);
    return { status: "failed", error: "Could not record email." };
  }
}

export async function resendEmail(id: number): Promise<Outcome> {
  const [row] = await db.select().from(emailLog).where(eq(emailLog.id, id));
  if (!row || !row.html) return { status: "failed", error: "This email cannot be resent." };
  const outcome = await transmit({
    to: row.toAddress,
    replyTo: row.replyTo ?? undefined,
    subject: row.subject,
    html: row.html,
    text: row.text,
    ics: row.ics ?? undefined,
    kind: row.kind,
  });
  await db
    .update(emailLog)
    .set({
      status: outcome.status,
      error: outcome.error ?? null,
      sentAt: outcome.status === "sent" ? new Date() : row.sentAt,
    })
    .where(eq(emailLog.id, id));
  return outcome;
}
