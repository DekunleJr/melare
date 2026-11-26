import { z } from "zod";
import { parsePounds } from "./money";

export const text = (max: number) => z.string().trim().max(max, `Maximum ${max} characters.`);
export const requiredText = (max: number, message = "This field is required.") =>
  text(max).min(1, message);
export const optionalText = (max: number) => text(max).default("");

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(255)
  .pipe(z.email("Enter a valid email address."));

export const phone = z
  .string()
  .trim()
  .max(40)
  .regex(/^[+()\d\s-]{7,}$/, "Enter a valid phone number.");

export const money = z.string().transform((value, ctx) => {
  const pence = parsePounds(value);
  if (pence === null) {
    ctx.addIssue({ code: "custom", message: "Enter an amount such as 12.50." });
    return z.NEVER;
  }
  return pence;
});

export const wholeNumber = (min: number, max: number) =>
  z.coerce
    .number({ error: "Enter a number." })
    .int("Enter a whole number.")
    .min(min, `Minimum ${min}.`)
    .max(max, `Maximum ${max}.`);

/** HTML checkboxes send "on" when ticked and nothing otherwise. */
export const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on");

export const id = z.coerce.number().int().positive();

export const contactDetails = {
  customerName: requiredText(120, "Enter your name."),
  customerEmail: email,
  customerPhone: phone,
};

export function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 140) || "item"
  );
}
