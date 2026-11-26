// A Windows terminal can report "c:\\..." instead of "C:\\...", which makes Vitest load
// itself twice and find no tests. Resolve the true path before starting it.
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";

const root = realpathSync.native(process.cwd());
const vitest = path.join(root, "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(process.execPath, [vitest, "run", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
