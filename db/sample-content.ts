/*
 * Placeholder hairdressing content so the site can be explored straight away.
 * Everything here is sample data to edit or delete in the admin dashboard.
 */
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import {
  categories,
  faqs,
  mobileAreas,
  posts,
  productImages,
  productVariants,
  products,
  serviceAddons,
  services,
  staff,
  staffServices,
  workingHours,
} from "@/db/schema";
import { saveImageBuffer } from "@/lib/storage";
import { slugify } from "@/lib/validation";

/** A soft abstract placeholder, clearly not a real photograph. */
export async function placeholder(from: string, to: string, shape: "bottle" | "circle") {
  const object =
    shape === "bottle"
      ? `<rect x="340" y="330" width="320" height="520" rx="70" fill="#fff" opacity=".55"/><rect x="430" y="220" width="140" height="130" rx="24" fill="#fff" opacity=".4"/>`
      : `<circle cx="640" cy="420" r="260" fill="#fff" opacity=".35"/><circle cx="360" cy="680" r="190" fill="#fff" opacity=".25"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="1000" height="1100" fill="url(#g)"/>${object}</svg>`;
  return saveImageBuffer(await sharp(Buffer.from(svg)).png().toBuffer());
}

/** Older items, even archived ones, may already use a web address. */
async function freeSlug(table: typeof products | typeof services, name: string) {
  const base = slugify(name);
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const [taken] =
      table === products
        ? await db.select({ id: products.id }).from(products).where(eq(products.slug, slug))
        : await db.select({ id: services.id }).from(services).where(eq(services.slug, slug));
    if (!taken) return slug;
  }
}

type Option = {
  colour?: string;
  length?: string;
  texture?: string;
  size?: string;
  price: number;
  sale?: number;
  stock: number;
};

const colours = ["1B Natural Black", "2 Dark Brown", "30 Auburn"];

const productData: [string, string, string, string, Option[]][] = [
  [
    "Pre-stretched Braiding Hair",
    "hair-extensions",
    "#8a6a55",
    "#33241c",
    colours.flatMap((colour) =>
      ["26 inch", "30 inch"].map((length) => ({
        colour,
        length,
        texture: "Yaki",
        price: length === "26 inch" ? 650 : 750,
        stock: 40,
      })),
    ),
  ],
  [
    "Curly Boho Bundles",
    "hair-extensions",
    "#c39a7a",
    "#6b4433",
    [
      { colour: "1B Natural Black", length: "16 inch", texture: "Water wave", price: 2800, stock: 15 },
      { colour: "1B Natural Black", length: "20 inch", texture: "Water wave", price: 3400, stock: 10 },
      { colour: "1B Natural Black", length: "20 inch", texture: "Deep curl", price: 3400, stock: 2 },
    ],
  ],
  [
    "Moisture Shampoo",
    "hair-care-products",
    "#b9c4b0",
    "#6f7f6a",
    [
      { size: "250 ml", price: 1100, stock: 30 },
      { size: "500 ml", price: 1800, stock: 20 },
    ],
  ],
  [
    "Scalp and Growth Oil",
    "hair-care-products",
    "#f0dcb4",
    "#c49a55",
    [{ size: "100 ml", price: 1400, sale: 1190, stock: 25 }],
  ],
  [
    "Wide Tooth Detangling Comb",
    "hair-styling-tools",
    "#d9c3cf",
    "#8d6b7f",
    [{ price: 500, stock: 60 }],
  ],
  [
    "Ionic Hair Dryer",
    "hair-styling-tools",
    "#d99a96",
    "#7e3138",
    [{ colour: "Black", price: 4500, stock: 8 }],
  ],
];

export async function addSampleContent() {
  const known = await db.select().from(categories);
  const categoryId = async (slug: string) => {
    const found = known.find((c) => c.slug === slug);
    if (found) return found.id;
    const name = slug
      .split("-")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");
    const [row] = await db.insert(categories).values({ name, slug }).$returningId();
    known.push({ id: row.id, name, slug, sortOrder: 0 });
    return row.id;
  };

  for (const [i, [name, category, from, to, options]] of productData.entries()) {
    const [row] = await db
      .insert(products)
      .values({
        name,
        slug: await freeSlug(products, name),
        categoryId: await categoryId(category),
        description: `Sample product. Replace this description of ${name.toLowerCase()} with what it does, how to use it and what is in it.`,
        featured: i < 4,
      })
      .$returningId();
    await db.insert(productVariants).values(
      options.map(({ price, sale, ...option }, sortOrder) => ({
        ...option,
        productId: row.id,
        pricePence: price,
        salePricePence: sale ?? 0,
        sortOrder,
      })),
    );
    await db
      .insert(productImages)
      .values({ productId: row.id, path: await placeholder(from, to, "bottle") });
  }

  const extensions = await categoryId("hair-extensions");
  const care = await categoryId("hair-care-products");
  const serviceData: (Omit<typeof services.$inferInsert, "slug" | "description" | "imagePath"> & {
    colours: [string, string];
    addons?: [string, number, number][];
  })[] = [
    {
      name: "Knotless Braids",
      category: "Braids",
      durationMinutes: 240,
      bufferMinutes: 15,
      pricePence: 12000,
      paymentMode: "deposit",
      depositType: "percent",
      depositPercent: 30,
      locationMode: "both",
      suggestedCategoryId: extensions,
      colours: ["#cbb09a", "#5d4034"],
      addons: [
        ["Extra length (waist)", 2000, 30],
        ["Boho curls", 1500, 30],
      ],
    },
    {
      name: "Cornrows",
      category: "Braids",
      durationMinutes: 90,
      bufferMinutes: 10,
      pricePence: 4500,
      paymentMode: "pay_at_salon",
      locationMode: "both",
      suggestedCategoryId: extensions,
      colours: ["#c7968a", "#6a332c"],
      addons: [["Wash before braiding", 1200, 30]],
    },
    {
      name: "Silk Press",
      category: "Styling",
      durationMinutes: 120,
      bufferMinutes: 10,
      pricePence: 6500,
      paymentMode: "deposit",
      depositType: "fixed",
      depositPence: 2000,
      suggestedCategoryId: care,
      colours: ["#dfc0c4", "#8c5a62"],
    },
    {
      name: "Full Colour",
      category: "Colour",
      durationMinutes: 150,
      bufferMinutes: 15,
      pricePence: 8500,
      paymentMode: "full",
      requiresApproval: true,
      suggestedCategoryId: care,
      colours: ["#d9d2bd", "#7c7454"],
    },
  ];
  const serviceIds: number[] = [];
  for (const [i, { colours: [from, to], addons, ...service }] of serviceData.entries()) {
    const [row] = await db
      .insert(services)
      .values({
        ...service,
        slug: await freeSlug(services, service.name),
        description: `Sample service. Describe what happens during your ${service.name.toLowerCase()} appointment and who it suits.`,
        featured: i < 3,
        sortOrder: i,
        imagePath: await placeholder(from, to, "circle"),
      })
      .$returningId();
    serviceIds.push(row.id);
    if (addons) {
      await db.insert(serviceAddons).values(
        addons.map(([name, pricePence, extraMinutes], sortOrder) => ({
          serviceId: row.id,
          name,
          pricePence,
          extraMinutes,
          sortOrder,
        })),
      );
    }
  }

  const team: [string, string, boolean, number[]][] = [
    ["Sample Braider", "Braiding specialist", true, [0, 1]],
    ["Sample Colourist", "Colour and styling", false, [0, 2, 3]],
  ];
  for (const [i, [name, title, offersMobile, offers]] of team.entries()) {
    const [row] = await db
      .insert(staff)
      .values({
        name,
        title,
        offersMobile,
        bio: "Sample profile. Add a short introduction in the admin dashboard.",
        sortOrder: i,
      })
      .$returningId();
    await db
      .insert(staffServices)
      .values(offers.map((o) => ({ staffId: row.id, serviceId: serviceIds[o] })));
    // Tuesday to Saturday
    await db.insert(workingHours).values(
      [2, 3, 4, 5, 6].map((weekday) => ({
        staffId: row.id,
        weekday,
        startMinute: 9 * 60,
        endMinute: (weekday === 6 ? 17 : 18) * 60,
      })),
    );
  }

  if (!(await db.select().from(mobileAreas).limit(1)).length) {
    await db.insert(mobileAreas).values([
      { district: "M1", feePence: 1000, travelMinutes: 30 },
      { district: "M14", feePence: 1500, travelMinutes: 45 },
    ]);
  }

  if (!(await db.select().from(faqs).limit(1)).length) {
    await db.insert(faqs).values([
      { question: "Do I need an account to book?", answer: "No. You can book and shop as a guest. An account keeps your history in one place.", sortOrder: 0 },
      { question: "Can I change my appointment?", answer: "Yes. Use the link in your confirmation email, or your account, before the notice period ends.", sortOrder: 1 },
      { question: "Can I buy hair when I book?", answer: "Yes. Add extensions or products while booking and pay for everything together.", sortOrder: 2 },
    ]);
  }

  const draft = "how-to-look-after-knotless-braids";
  if (!(await db.select().from(posts).where(eq(posts.slug, draft))).length) {
    await db.insert(posts).values({
      title: "How to look after knotless braids",
      slug: draft,
      excerpt: "Sample draft article.",
      body: "## Sample article\nReplace this with your own advice, then set it to Published.\n\n- Tie your hair at night\n- Keep your scalp clean",
    });
  }
}
