/*
 *   npm run db:seed
 * Adds sample content to an empty site. It does nothing if services or products
 * already exist.
 */
import { count } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { products, services } from "@/db/schema";
import { readSettings, writeSettings } from "@/lib/settings";
import { addSampleContent, placeholder } from "./sample-content";

async function main() {
  const [[{ total: serviceCount }], [{ total: productCount }]] = await Promise.all([
    db.select({ total: count() }).from(services),
    db.select({ total: count() }).from(products),
  ]);
  if (serviceCount || productCount) {
    console.log("Content already exists, so nothing was added.");
    return;
  }
  await addSampleContent();
  if (!(await readSettings()).heroImage) {
    await writeSettings({ heroImage: await placeholder("#e4cdb9", "#9a6a58", "circle") });
  }
  console.log("Sample content added.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
