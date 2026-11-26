import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import { bookingImages } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { privateDir, UPLOAD_NAME } from "@/lib/storage";

/** Customers' reference photos are shown to administrators only. */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/booking-images/[id]">) {
  await requireAdmin();
  const id = Number((await ctx.params).id) || 0;
  const [image] = await db.select().from(bookingImages).where(eq(bookingImages.id, id));
  if (!image || !UPLOAD_NAME.test(image.fileName)) {
    return new Response("Not found", { status: 404 });
  }
  const file = await readFile(path.join(privateDir(), image.fileName)).catch(() => null);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
