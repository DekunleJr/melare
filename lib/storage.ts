import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const UPLOAD_NAME = /^[a-f0-9-]{36}\.webp$/;

export function uploadDir() {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "storage", "uploads");
}

/** Customers' photos: only served after an administrator check. */
export function privateDir() {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "storage", "private");
}

export class UploadError extends Error {}

/** Re-encode to WebP: strips metadata and guarantees the file really is an image. */
async function toWebp(input: Buffer): Promise<Buffer> {
  let output: Buffer;
  try {
    const image = sharp(input, { limitInputPixels: 50_000_000 });
    const { format } = await image.metadata();
    if (!format || !["jpeg", "png", "webp", "avif", "heif", "gif"].includes(format)) {
      throw new UploadError("Please upload a JPG, PNG, WebP or AVIF image.");
    }
    output = await image
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer();
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError("That file could not be read as an image.");
  }
  return output;
}

async function store(folder: string, input: Buffer): Promise<string> {
  const output = await toWebp(input);
  const name = `${randomUUID()}.webp`;
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, name), output);
  return name;
}

export const saveImageBuffer = async (input: Buffer) =>
  `/uploads/${await store(uploadDir(), input)}`;

async function read(file: FormDataEntryValue | null): Promise<Buffer | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Images must be 5 MB or smaller.");
  return Buffer.from(await file.arrayBuffer());
}

/** Returns null when the form field was left empty. */
export async function saveImage(file: FormDataEntryValue | null): Promise<string | null> {
  const input = await read(file);
  return input ? saveImageBuffer(input) : null;
}

/** Returns the private file name, or null when the field was left empty. */
export async function savePrivateImage(file: FormDataEntryValue | null): Promise<string | null> {
  const input = await read(file);
  return input ? store(privateDir(), input) : null;
}

export async function deletePrivateImage(name: string) {
  if (UPLOAD_NAME.test(name)) await unlink(path.join(privateDir(), name)).catch(() => {});
}

export async function deleteImage(publicPath: string | null | undefined) {
  const name = publicPath?.replace("/uploads/", "");
  if (!name || !UPLOAD_NAME.test(name)) return;
  await unlink(path.join(uploadDir(), name)).catch(() => {});
}
