/*
 * One-off helper for a site that still holds the first version's sample content.
 *   npm run db:refresh-samples
 * Archives untouched "Sample ..." items (nothing is deleted) and adds the
 * hairdressing samples. Anything whose description you changed is left alone.
 */
import { inArray, like } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { products, services, staff } from "@/db/schema";
import { addSampleContent } from "@/db/sample-content";

async function main() {
  const oldProducts = await db
    .select()
    .from(products)
    .where(like(products.description, "Sample product.%"));
  const oldServices = await db
    .select()
    .from(services)
    .where(like(services.description, "Sample service.%"));
  const oldStaff = await db
    .select()
    .from(staff)
    .where(inArray(staff.name, ["Sample Stylist", "Sample Therapist"]));
  if (oldProducts.some((p) => p.name === "Pre-stretched Braiding Hair")) {
    console.log("The hairdressing samples are already installed.");
    return;
  }

  await addSampleContent();
  if (oldProducts.length) {
    await db
      .update(products)
      .set({ status: "archived" })
      .where(inArray(products.id, oldProducts.map((p) => p.id)));
  }
  if (oldServices.length) {
    await db
      .update(services)
      .set({ status: "archived" })
      .where(inArray(services.id, oldServices.map((s) => s.id)));
  }
  if (oldStaff.length) {
    await db
      .update(staff)
      .set({ active: false })
      .where(inArray(staff.id, oldStaff.map((s) => s.id)));
  }
  console.log(
    `Archived ${oldProducts.length} sample products, ${oldServices.length} sample services and ${oldStaff.length} sample staff, then added hairdressing samples.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
