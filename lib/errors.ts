/** An error whose message is safe and useful to show to the person using the site. */
export class UserError extends Error {}

function mysqlCode(error: unknown): string | undefined {
  let current = error as { code?: string; cause?: unknown } | undefined;
  // Drizzle wraps driver errors, so walk the cause chain.
  for (let i = 0; current && i < 5; i++) {
    if (typeof current.code === "string") return current.code;
    current = current.cause as typeof current;
  }
}

export const isDuplicateEntry = (error: unknown) => mysqlCode(error) === "ER_DUP_ENTRY";

/** Re-run a transaction that lost a deadlock or lock wait. */
export async function withRetry<T>(work: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      const code = mysqlCode(error);
      const retryable = code === "ER_LOCK_DEADLOCK" || code === "ER_LOCK_WAIT_TIMEOUT";
      if (!retryable || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 30 * attempt + Math.random() * 50));
    }
  }
}
