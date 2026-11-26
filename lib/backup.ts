import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { readSettings } from "./settings";

/*
 * A backup is a folder holding database.sql plus copies of the uploaded files.
 * It lives on this server: copy the folder somewhere else to protect against the
 * server itself failing.
 */
export const BACKUP_NAME = /^\d{4}-\d{2}-\d{2}_\d{6}$/;

const root = () => path.join(/* turbopackIgnore: true */ process.cwd());
export const backupDir = () => path.join(root(), "backups");

function dumpProgram(): string {
  if (env.mysqldumpPath) return env.mysqldumpPath;
  // Built at run time: the bundler must not try to resolve a program on this computer.
  const xampp = [process.env.SystemDrive || "C:", "xampp", "mysql", "bin", "mysqldump.exe"].join(
    path.sep,
  );
  return existsSync(/* turbopackIgnore: true */ xampp) ? xampp : "mysqldump";
}

function dumpDatabase(target: string): Promise<void> {
  const url = new URL(env.databaseUrl);
  const args = [
    `--host=${url.hostname}`,
    `--port=${url.port || "3306"}`,
    `--user=${decodeURIComponent(url.username)}`,
    "--single-transaction",
    "--no-tablespaces",
    "--default-character-set=utf8mb4",
    `--result-file=${target}`,
    url.pathname.slice(1),
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(dumpProgram(), args, {
      // Keeps the password off the command line.
      env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let errors = "";
    child.stderr.on("data", (chunk) => (errors += chunk));
    child.on("error", () =>
      reject(new Error("mysqldump was not found. Set MYSQLDUMP_PATH in your environment file.")),
    );
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`Database backup failed: ${errors.trim()}`)),
    );
  });
}

export async function listBackups() {
  const names = await readdir(backupDir()).catch(() => []);
  const found = [];
  for (const name of names.filter((n) => BACKUP_NAME.test(n)).sort().reverse()) {
    const info = await stat(path.join(backupDir(), name, "database.sql")).catch(() => null);
    if (info) found.push({ name, createdAt: info.mtime, databaseBytes: info.size });
  }
  return found;
}

export async function createBackup(now = new Date()) {
  const name = now.toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "");
  const folder = path.join(backupDir(), name);
  await mkdir(folder, { recursive: true });
  try {
    await dumpDatabase(path.join(folder, "database.sql"));
    for (const files of ["uploads", "private"]) {
      const source = path.join(root(), "storage", files);
      if (existsSync(source)) await cp(source, path.join(folder, files), { recursive: true });
    }
  } catch (error) {
    await rm(folder, { recursive: true, force: true });
    throw error;
  }
  // Keep only the most recent ones. Folders with other names are never touched.
  const { backupKeep } = await readSettings();
  for (const old of (await listBackups()).slice(Math.max(1, backupKeep))) {
    await rm(path.join(backupDir(), old.name), { recursive: true, force: true });
  }
  return name;
}

/** Makes a backup if the newest one is more than a day old. */
export async function backupIfDue(now = new Date()) {
  const [latest] = await listBackups();
  if (latest && now.getTime() - latest.createdAt.getTime() < 23 * 3_600_000) return null;
  return createBackup(now);
}
