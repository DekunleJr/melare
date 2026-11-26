import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_NAME, uploadDir } from "@/lib/storage";

// Files added to /public after a build are not served, so uploads are streamed from here.
export async function GET(_request: Request, ctx: RouteContext<"/uploads/[name]">) {
  const { name } = await ctx.params;
  // The strict pattern rules out path traversal.
  if (!UPLOAD_NAME.test(name)) return new Response("Not found", { status: 404 });
  try {
    const file = await readFile(path.join(uploadDir(), name));
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
