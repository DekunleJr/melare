// UK postcode helpers. Safe to use in the browser and on the server.

const FULL = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/;
/** A district such as "M14" or "EC1A", or a whole area such as "M" */
const DISTRICT = /^[A-Z]{1,2}(\d[A-Z\d]?)?$/;

/** "m145ab" → "M14 5AB". Returns null if it is not a full UK postcode. */
export function normalisePostcode(input: string): string | null {
  const match = FULL.exec(input.trim().toUpperCase());
  return match ? `${match[1]} ${match[2]}` : null;
}

export function normaliseDistrict(input: string): string | null {
  const value = input.trim().toUpperCase();
  return DISTRICT.test(value) ? value : null;
}

/**
 * The most specific entry covering a postcode: an exact district beats a whole area.
 * "M1" does not match "M14".
 */
export function matchPostcode<T>(
  entries: T[],
  districtOf: (entry: T) => string,
  postcode: string,
): T | null {
  const full = normalisePostcode(postcode);
  if (!full) return null;
  const district = full.split(" ")[0];
  const area = district.match(/^[A-Z]+/)![0];
  return (
    entries.find((e) => districtOf(e) === district) ??
    entries.find((e) => districtOf(e) === area) ??
    null
  );
}

/** Parse "M1, M14, SK" typed by an admin. Invalid parts are returned separately. */
export function parseDistrictList(input: string) {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const part of input.split(/[,\s]+/).filter(Boolean)) {
    const district = normaliseDistrict(part);
    if (district) valid.push(district);
    else invalid.push(part);
  }
  return { valid: [...new Set(valid)], invalid };
}
