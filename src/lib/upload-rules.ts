import path from "node:path";

/**
 * Pure upload policy: size cap, type allowlist and filename sanitising.
 *
 * Kept separate from `storage.ts` (which touches the filesystem) so the rules can
 * be unit-tested and referenced from anywhere.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Types a client or staff member can exchange. An allowlist keeps executables
 * and scripts out of the store entirely.
 */
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".txt",
  ".csv",
  ".md",
  ".json",
  ".zip",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
]);

/** Value for an <input type="file"> accept attribute. */
export const ACCEPT_ATTRIBUTE = [...ALLOWED_EXTENSIONS].join(",");

export const REJECTED_TYPE_MESSAGE =
  "That file type is not accepted. Allowed: documents, spreadsheets, presentations, PDFs, images, text, CSV, JSON and ZIP.";

/** Strip any path information and unsafe characters from a client-supplied name. */
export function safeFilename(raw: string): string {
  const base = path.basename(raw);
  // Drop control characters, then keep only characters that are safe in a
  // Content-Disposition header and on every filesystem.
  const withoutControls = base.replace(/[\u0000-\u001f\u007f]/g, "");
  const cleaned = withoutControls.replace(/[^\w.\-() \[\]]+/g, "_").trim();
  return (cleaned || "file").slice(0, 180);
}

export function isAllowedUpload(filename: string, mimeType: string): boolean {
  const extension = path.extname(filename).toLowerCase();
  // Browsers sometimes send an empty or generic type; the extension decides then.
  const typeOk =
    mimeType === "" ||
    mimeType === "application/octet-stream" ||
    ALLOWED_MIME_TYPES.has(mimeType);
  return ALLOWED_EXTENSIONS.has(extension) && typeOk;
}

/** Types safe to render inline in the browser — SVG can carry script, so never. */
export function isInlineSafe(mimeType: string): boolean {
  return ["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"].includes(
    mimeType,
  );
}
