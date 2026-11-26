/*
 *   npm run restore -- <backup folder name> --yes
 * REPLACES the current database tables and uploaded files with those in a backup.
 * Stop the website first.
 */
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { cp } from "node:fs/promises";
import path from "node:path";
import { BACKUP_NAME, backupDir } from "@/lib/backup";
import { env } from "@/lib/env";

function mysqlProgram() {
  if (env.mysqldumpPath) return env.mysqldumpPath.replace(/mysqldump(\.exe)?$/i, "mysql$1");
  const xampp = "C:\\xampp\\mysql\\bin\\mysql.exe";
  return existsSync(xampp) ? xampp : "mysql";
}

async function main() {
  const [name, confirm] = process.argv.slice(2);
  const folder = path.join(backupDir(), name ?? "");
  const file = path.join(folder, "database.sql");
  if (!name || !BACKUP_NAME.test(name) || !existsSync(file)) {
    throw new Error("Usage: npm run restore -- <backup folder name> --yes");
  }
  const url = new URL(env.databaseUrl);
  const database = url.pathname.slice(1);
  if (confirm !== "--yes") {
    throw new Error(
      `This replaces the "${database}" database and uploaded files with backup ${name}. Add --yes to continue.`,
    );
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      mysqlProgram(),
      [
        `--host=${url.hostname}`,
        `--port=${url.port || "3306"}`,
        `--user=${decodeURIComponent(url.username)}`,
        "--default-character-set=utf8mb4",
        database,
      ],
      {
        env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) },
        stdio: ["pipe", "inherit", "inherit"],
      },
    );
    child.on("error", () => reject(new Error("The mysql program was not found.")));
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error("The database could not be restored.")),
    );
    createReadStream(file).pipe(child.stdin!);
  });
  for (const files of ["uploads", "private"]) {
    const source = path.join(folder, files);
    if (existsSync(source)) {
      await cp(source, path.join(process.cwd(), "storage", files), { recursive: true });
    }
  }
  console.log(`Restored ${database} from ${name}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
