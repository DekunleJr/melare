/*
 * Create the first administrator, or promote an existing account.
 *   npm run create-admin
 * Optional environment variables for unattended use:
 *   ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD
 */
import { createInterface } from "node:readline/promises";
import { eq } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { user } from "@/db/schema";
import { getAuth } from "@/lib/auth";

async function main() {
  process.env.MELARE_NO_WELCOME = "1";
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (envName: string, question: string) =>
    (process.env[envName] || (await prompt.question(question))).trim();

  try {
    const email = (await ask("ADMIN_EMAIL", "Admin email: ")).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("That is not a valid email address.");

    const [existing] = await db.select().from(user).where(eq(user.email, email));
    if (!existing) {
      const name = await ask("ADMIN_NAME", "Name: ");
      const password = await ask("ADMIN_PASSWORD", "Password (at least 8 characters, shown as you type): ");
      if (!name) throw new Error("A name is required.");
      await getAuth().api.signUpEmail({ body: { name, email, password } });
    }
    await db.update(user).set({ role: "admin", disabled: false }).where(eq(user.email, email));
    console.log(
      existing
        ? `${email} is now an administrator. Their password is unchanged.`
        : `Administrator ${email} created.`,
    );
  } finally {
    prompt.close();
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
