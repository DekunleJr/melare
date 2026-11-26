// Runs the database tests against a separate "<database>_test" database, never the real one.
import { spawnSync } from "node:child_process";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env.local");
} catch {
  // The variables may already be set.
}
const url = new URL(process.env.DATABASE_URL);
if (!url.pathname.endsWith("_test")) url.pathname += "_test";
const env = { ...process.env, DATABASE_URL: url.toString(), RESEND_API_KEY: "" };
const name = url.pathname.slice(1);

function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", env });
  if (result.status !== 0) {
    console.error(
      `\nTests need an empty database called "${name}" that your database user can use. See the README.`,
    );
    process.exit(result.status ?? 1);
  }
}
console.log(`Testing against the "${name}" database.`);
run(["node_modules/drizzle-kit/bin.cjs", "migrate"]);
run(["--conditions=react-server", "--import", "tsx", "scripts/integration-test.ts"]);
