import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { humanFileSize } from "@/lib/format";
import {
  MAX_UPLOAD_BYTES,
  REJECTED_TYPE_MESSAGE,
  isAllowedUpload,
  safeFilename,
} from "@/lib/upload-rules";

/**
 * Local-disk file storage.
 *
 * Bytes are written under UPLOAD_DIR with a randomised name and are never served
 * as static assets — every download goes through /api/files/[id], which checks
 * that the caller is staff or the owning client. Swapping this module for S3 or
 * similar means reimplementing `saveUpload`, `uploadPath` and `deleteUpload`;
 * nothing else touches the filesystem. Upload policy lives in `upload-rules.ts`.
 */

export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "uploads");

export type UploadRejection = { error: string };
export type UploadResult = {
  filename: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
};

/**
 * Validate and persist one uploaded file. Returns either the stored metadata or
 * a message safe to show the uploader.
 */
export async function saveUpload(file: File): Promise<UploadResult | UploadRejection> {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: `Files must be ${humanFileSize(MAX_UPLOAD_BYTES)} or smaller.` };
  }

  const filename = safeFilename(file.name);
  const mimeType = file.type || "application/octet-stream";
  if (!isAllowedUpload(filename, mimeType)) {
    return { error: REJECTED_TYPE_MESSAGE };
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const extension = path.extname(filename).toLowerCase();
  const storedName = `${Date.now().toString(36)}-${randomBytes(12).toString("hex")}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, storedName), bytes);

  return { filename, storedName, mimeType, sizeBytes: bytes.byteLength };
}

/** Absolute path for a stored file, guarding against traversal via storedName. */
export function uploadPath(storedName: string): string {
  const resolved = path.resolve(UPLOAD_DIR, path.basename(storedName));
  if (!resolved.startsWith(UPLOAD_DIR)) {
    throw new Error("Refusing to resolve a path outside the upload directory");
  }
  return resolved;
}

export async function deleteUpload(storedName: string): Promise<void> {
  try {
    await unlink(uploadPath(storedName));
  } catch (error) {
    // A missing file should not block deleting its database row.
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") console.error("Failed to delete upload", error);
  }
}

/** Stable ETag so browsers can cache a download they already have. */
export function etagFor(storedName: string, sizeBytes: number): string {
  return `"${createHash("sha1").update(`${storedName}:${sizeBytes}`).digest("hex")}"`;
}
