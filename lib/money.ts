// All money is held as integer pence.
export const CURRENCY = "GBP";

const formatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: CURRENCY });

export function formatPence(pence: number): string {
  return formatter.format(pence / 100);
}

/** "12", "12.5" or "£1,200.99" → pence. Returns null for anything else. */
export function parsePounds(input: string): number | null {
  const cleaned = input.replace(/[£,\s]/g, "");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [pounds, fraction = ""] = cleaned.split(".");
  return Number(pounds) * 100 + Number(fraction.padEnd(2, "0"));
}

export function penceToInput(pence: number): string {
  return (pence / 100).toFixed(2);
}
