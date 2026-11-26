import "server-only";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "@/lib/env";

// Reuse the pool across hot reloads in development.
const globalForDb = globalThis as unknown as { melarePool?: mysql.Pool };

const pool =
  globalForDb.melarePool ??
  mysql.createPool({
    uri: env.databaseUrl,
    connectionLimit: 10,
    timezone: "Z",
    charset: "utf8mb4",
  });

if (process.env.NODE_ENV !== "production") globalForDb.melarePool = pool;

// Relational queries are deliberately not enabled: see db/relations.ts.
export const db = drizzle(pool);

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function closeDb() {
  await pool.end();
}
