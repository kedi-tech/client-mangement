import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { Readable } from "node:stream";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { etagFor, uploadPath } from "@/lib/storage";
import { isInlineSafe } from "@/lib/upload-rules";

/**
 * Authorised file download.
 *
 * Uploads are never exposed as static assets: staff may fetch any file, and a
 * portal user may fetch only files belonging to their own client. Everything
 * else gets a 404 rather than a 403, so the endpoint reveals nothing about which
 * ids exist.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) return new Response("Not found", { status: 404 });

  if (user.role === "CLIENT" && attachment.clientId !== user.clientId) {
    return new Response("Not found", { status: 404 });
  }

  let filePath: string;
  try {
    filePath = uploadPath(attachment.storedName);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const stats = await stat(filePath).catch(() => null);
  if (!stats?.isFile()) {
    return new Response("This file is no longer available on the server.", { status: 410 });
  }

  const etag = etagFor(attachment.storedName, attachment.sizeBytes);
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  // Only render types that cannot carry script inline. SVG in particular is
  // always downloaded, since an inline SVG would execute on this origin.
  const inline =
    request.headers.get("sec-fetch-dest") === "document" && isInlineSafe(attachment.mimeType)
      ? "inline"
      : "attachment";
  const body = Readable.toWeb(createReadStream(filePath)) as NodeWebReadableStream<Uint8Array>;

  return new Response(body as unknown as ReadableStream, {
    headers: {
      // Types are constrained by the upload allowlist, so echoing it back is safe.
      "Content-Type": attachment.mimeType || "application/octet-stream",
      "Content-Length": String(stats.size),
      "Content-Disposition": `${inline}; filename="${attachment.filename.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      ETag: etag,
    },
  });
}
