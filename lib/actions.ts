import "server-only";
import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { UserError } from "./errors";
import type { FormState } from "./forms";
import { UploadError } from "./storage";

/**
 * Wraps every form action: re-renders the page after success, turns expected
 * failures into form messages and hides unexpected ones.
 */
export async function runAction(work: () => Promise<FormState>): Promise<FormState> {
  try {
    const result = await work();
    if (result.ok) refresh();
    return result;
  } catch (error) {
    // Let redirect() and notFound() work as normal.
    unstable_rethrow(error);
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      for (const issue of error.issues) errors[String(issue.path[0])] ??= issue.message;
      return { message: "Please check the highlighted fields.", errors };
    }
    if (error instanceof UserError || error instanceof UploadError) {
      return { message: error.message };
    }
    console.error(error);
    return { message: "Something went wrong. Please try again." };
  }
}

export function formObject(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()].filter(([key]) => !key.startsWith("$ACTION")),
  );
}
