import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { BACKUP_NAME, backupDir } from "@/lib/backup";
import { requireAdmin } from "@/lib/session";

/** Download the database part of a backup. */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/backups/[name]">) {
  await requireAdmin();
  const { name } = await ctx.params;
  // The strict pattern rules out path traversal.
  if (!BACKUP_NAME.test(name)) return new Response("Not found", { status: 404 });
  const file = path.join(backupDir(), name, "database.sql");
  const info = await stat(file).catch(() => null);
  if (!info) return new Response("Not found", { status: 404 });
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: {
      "Content-Type": "application/sql",
      "Content-Length": String(info.size),
      "Content-Disposition": `attachment; filename="backup-${name}.sql"`,
      "Cache-Control": "private, no-store",
    },
  });
}
