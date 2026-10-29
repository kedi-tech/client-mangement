import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { humanFileSize } from "@/lib/format";
import {
  MAX_UPLOAD_BYTES,
  REJECTED_TYPE_MESSAGE,
  isAllowedUpload,
  safeFilename,
} from "@/lib/upload-rules";

/**
 * File storage for client uploads.
 *
 * Two backends, picked from the environment:
 *
 *   - Object storage (Neon Object Storage, or any S3-compatible bucket) when
 *     STORAGE_BUCKET is set. Credentials come from the standard AWS variables
 *     Neon injects: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
 *     AWS_ENDPOINT_URL_S3 and AWS_REGION.
 *   - Local disk under UPLOAD_DIR (default ./uploads) otherwise — handy in
 *     development.
 *
 * Either way only the object key (`Attachment.storedName`) and metadata live in
 * Postgres, and files are never public: every download goes through
 * /api/files/[id], which authorises the caller and then streams the bytes.
 * Upload policy (size, types, filenames) lives in `upload-rules.ts`.
 */

export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "uploads");

const BUCKET = process.env.STORAGE_BUCKET?.trim() || null;

/** Objects go under this prefix inside the bucket, e.g. "attachments/…". */
const KEY_PREFIX = "attachments/";

export function usingObjectStorage(): boolean {
  return BUCKET !== null;
}

let s3: S3Client | null = null;
function client(): S3Client {
  s3 ??= new S3Client({
    region: process.env.AWS_REGION || "us-east-2",
    endpoint: process.env.AWS_ENDPOINT_URL_S3 || undefined,
    // Most S3-compatible services expect bucket-in-path URLs.
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE !== "false",
  });
  return s3;
}

/** Object key for a stored name. `basename` keeps a crafted name inside the prefix. */
function objectKey(storedName: string): string {
  return KEY_PREFIX + path.basename(storedName);
}

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

  const extension = path.extname(filename).toLowerCase();
  const storedName = `${Date.now().toString(36)}-${randomBytes(12).toString("hex")}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (BUCKET) {
    try {
      await client().send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: objectKey(storedName),
          Body: bytes,
          ContentType: mimeType,
          ContentLength: bytes.byteLength,
        }),
      );
    } catch (error) {
      console.error("Failed to upload to object storage", error);
      return { error: "The file could not be stored. Please try again." };
    }
  } else {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(uploadPath(storedName), bytes);
  }

  return { filename, storedName, mimeType, sizeBytes: bytes.byteLength };
}

/** Absolute path for a locally stored file, guarding against traversal via storedName. */
export function uploadPath(storedName: string): string {
  const resolved = path.resolve(UPLOAD_DIR, path.basename(storedName));
  // Compare against the directory *plus its separator*, so a sibling directory
  // that merely shares a prefix ("/var/uploads-old") cannot pass the check.
  if (!resolved.startsWith(UPLOAD_DIR + path.sep)) {
    throw new Error("Refusing to resolve a path outside the upload directory");
  }
  return resolved;
}

/** The bytes of a stored file as a web stream, or null when it is gone. */
export async function readUpload(
  storedName: string,
): Promise<{ body: ReadableStream<Uint8Array>; size: number } | null> {
  if (BUCKET) {
    try {
      const object = await client().send(new GetObjectCommand({ Bucket: BUCKET, Key: objectKey(storedName) }));
      if (!object.Body) return null;
      return {
        body: object.Body.transformToWebStream() as ReadableStream<Uint8Array>,
        size: object.ContentLength ?? 0,
      };
    } catch (error) {
      if (error instanceof NoSuchKey || (error as { name?: string }).name === "NoSuchKey") return null;
      throw error;
    }
  }

  let filePath: string;
  try {
    filePath = uploadPath(storedName);
  } catch {
    return null;
  }
  const stats = await stat(filePath).catch(() => null);
  if (!stats?.isFile()) return null;
  return {
    body: Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream<Uint8Array>,
    size: stats.size,
  };
}

export async function deleteUpload(storedName: string): Promise<void> {
  try {
    if (BUCKET) {
      await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: objectKey(storedName) }));
    } else {
      await unlink(uploadPath(storedName));
    }
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
