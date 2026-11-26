import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { runScheduledTasks } from "@/features/tasks";
import { env } from "@/lib/env";
import { TAGS } from "@/lib/tags";

function authorised(request: Request) {
  if (!env.cronSecret) return false;
  const expected = Buffer.from(`Bearer ${env.cronSecret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Called by the built-in scheduler (instrumentation.ts), or by a host's own. */
export async function POST(request: Request) {
  if (!authorised(request)) return new Response("Unauthorised", { status: 401 });
  const result = await runScheduledTasks({ defer: (task) => after(task) });
  if (result.released) revalidateTag(TAGS.products, { expire: 0 });
  return Response.json(result);
}
