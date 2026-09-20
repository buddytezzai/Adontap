import "server-only";

// Customer file storage. Files live OUTSIDE /public (which Next only serves as it existed at build time,
// and which would expose every upload to anyone with the URL). They are read back through
// GET /api/uploads/[name], which checks the requester owns the file. On serverless / multi-instance
// hosting, point UPLOAD_DIR at a persistent volume or replace this module with an S3/R2 adapter.

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const UPLOAD_URL_PREFIX = "/api/uploads/";
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;
export type ImageExt = keyof typeof TYPES;

/** Server-generated names only — never anything derived from the client's filename. */
const NAME_RE = /^up_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

function uploadDir(): string {
  return process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(process.cwd(), ".uploads");
}

/** What the bytes actually are. The declared MIME type and file extension are attacker-controlled; this is not. */
export function sniffImage(b: Buffer): ImageExt | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export function contentTypeFor(name: string): string | null {
  const ext = name.split(".").pop() as ImageExt | undefined;
  return ext && ext in TYPES ? TYPES[ext] : null;
}

export function isValidUploadName(name: string): boolean {
  return NAME_RE.test(name);
}

export async function saveUpload(buffer: Buffer, ext: ImageExt): Promise<{ name: string; storageUrl: string }> {
  await fs.mkdir(uploadDir(), { recursive: true });
  const name = `up_${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(uploadDir(), name), buffer, { flag: "wx" });
  return { name, storageUrl: UPLOAD_URL_PREFIX + name };
}

export async function readUpload(name: string): Promise<Buffer | null> {
  if (!isValidUploadName(name)) return null;
  try {
    return await fs.readFile(path.join(uploadDir(), name));
  } catch {
    return null;
  }
}

/** Removes the file behind a `storageUrl`. Anything that isn't one of our uploads (samples, provider URLs) is left alone. */
export async function deleteStored(storageUrl: string): Promise<void> {
  let file: string | null = null;
  if (storageUrl.startsWith(UPLOAD_URL_PREFIX)) {
    const name = storageUrl.slice(UPLOAD_URL_PREFIX.length);
    if (isValidUploadName(name)) file = path.join(uploadDir(), name);
  } else if (storageUrl.startsWith("/uploads/")) {
    // Legacy location (public/uploads) from before uploads moved out of /public.
    const name = path.basename(storageUrl);
    if (/^up_[0-9a-f-]{36}\.[a-z0-9]{1,5}$/.test(name)) file = path.join(process.cwd(), "public", "uploads", name);
  }
  if (!file) return;
  try {
    await fs.unlink(file);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}
