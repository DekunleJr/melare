import "server-only";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { env } from "./env";

/** Everything the admin can change under Admin > Settings, with starting values. */
export const defaultSettings = {
  businessName: "MelareBeauty",
  tagline: "Hairdressing & hair products",
  heroTitle: "Great hair, made easy.",
  heroSubtitle:
    "Expert braiding, styling and colour in our salon or at your home, with the extensions and care products to match.",
  heroImage: "",
  aboutText:
    "MelareBeauty is a hairdressing and hair products business in the UK. We bring braiding, styling and colour together with the extensions, hair care and styling tools that help you look after your hair between visits.",
  phone: "",
  publicEmail: "",
  contactEmail: "",
  address: "",
  openingHours:
    "Monday: Closed\nTuesday: 09:00 - 18:00\nWednesday: 09:00 - 18:00\nThursday: 09:00 - 20:00\nFriday: 09:00 - 18:00\nSaturday: 09:00 - 17:00\nSunday: Closed",
  whatsapp: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  announcement: "",
  pickupEnabled: 1,
  pickupInstructions: "We will email you when your order is ready to collect from the salon.",
  bookingLeadHours: 2,
  bookingHorizonDays: 60,
  slotIntervalMinutes: 15,
  cancellationNoticeHours: 24,
  cancellationPolicy:
    "You can cancel or reschedule online up to the notice period before your appointment. Later changes must be made by contacting the salon, and deposits may not be refunded.",
  mobileEnabled: 1,
  mobileNeedsApproval: 1,
  approvalHoldHours: 48,
  paymentLinkHours: 24,
  abandonedCartHours: 4,
  backupKeep: 14,
  gaMeasurementId: "",
  /** Changing this value invalidates the admin calendar feed link */
  calendarNonce: "1",
};

export type Settings = typeof defaultSettings;

export async function readSettings(): Promise<Settings> {
  const rows = await db.select().from(settings);
  const result: Record<string, string | number> = { ...defaultSettings };
  for (const row of rows) {
    if (!(row.key in defaultSettings)) continue;
    const isNumber = typeof defaultSettings[row.key as keyof Settings] === "number";
    result[row.key] = isNumber ? Number(row.value) : row.value;
  }
  return result as Settings;
}

export async function writeSettings(values: Partial<Settings>) {
  for (const [key, value] of Object.entries(values)) {
    await db
      .insert(settings)
      .values({ key, value: String(value) })
      .onDuplicateKeyUpdate({ set: { value: String(value) } });
  }
}

/** Where new booking, order and contact notifications go. */
export function notificationRecipient(s: Settings): string {
  return s.contactEmail || env.contactEmail;
}
