/**
 * Copy files from the local upload folder into object storage.
 *
 * For every Attachment row whose file is on disk but not yet in the bucket,
 * uploads it under the same key the app uses ("attachments/<storedName>").
 * Nothing in the database changes — the stored name is already the key — and
 * local files are left in place, so this is safe to re-run.
 *
 *   npm run uploads:to-bucket            # preview
 *   npm run uploads:to-bucket -- --apply # copy the files
 */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const KEY_PREFIX = "attachments/";

async function main() {
  const apply = process.argv.includes("--apply");
  const bucket = process.env.STORAGE_BUCKET?.trim();
  if (!bucket) {
    console.error("STORAGE_BUCKET is not set. Add it (and the AWS_* credentials) to .env first.");
    process.exit(1);
  }

  const uploadDir = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), "uploads");
  const s3 = new S3Client({
    region: process.env.AWS_REGION || "us-east-2",
    endpoint: process.env.AWS_ENDPOINT_URL_S3 || undefined,
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE !== "false",
  });

  const attachments = await prisma.attachment.findMany({
    select: { storedName: true, filename: true, mimeType: true },
  });

  let toCopy = 0;
  let alreadyThere = 0;
  let missingLocally = 0;
  for (const file of attachments) {
    const key = KEY_PREFIX + path.basename(file.storedName);
    const exists = await s3
      .send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      .then(() => true)
      .catch(() => false);
    if (exists) {
      alreadyThere += 1;
      continue;
    }

    const localPath = path.join(uploadDir, path.basename(file.storedName));
    if (!(await stat(localPath).catch(() => null))) {
      missingLocally += 1;
      console.log(`  missing on disk: ${file.filename}`);
      continue;
    }

    toCopy += 1;
    console.log(`  ${apply ? "copying" : "would copy"}: ${file.filename}`);
    if (apply) {
      const bytes = await readFile(localPath);
      await s3.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: file.mimeType }),
      );
    }
  }

  console.log(
    `\n${attachments.length} files: ${toCopy} ${apply ? "copied" : "to copy"}, ${alreadyThere} already in the bucket, ${missingLocally} missing on disk.`,
  );
  if (!apply && toCopy > 0) console.log("Dry run — re-run with --apply to copy them.\n");
}

main()
  .catch((error) => {
    console.error("Copy failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
