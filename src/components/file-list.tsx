import Link from "next/link";

import { ConfirmForm } from "@/components/confirm-form";
import { EmptyRow, Pill } from "@/components/ui";
import { humanFileSize, relativeTime } from "@/lib/format";
import { deleteFileAction } from "@/server/actions/files";

export type FileListItem = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  note: string | null;
  createdAt: Date;
  uploader?: { name: string } | null;
  project?: { id: string; name: string } | null;
};

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot + 1, dot + 5) : "file";
}

/**
 * Admin file rows: name, origin pill, message and meta, with Download and Delete.
 * Staff may delete anything.
 */
export function FileList({
  files,
  showProject = true,
  emptyText = "No files yet.",
}: {
  files: FileListItem[];
  showProject?: boolean;
  emptyText?: string;
}) {
  if (files.length === 0) return <EmptyRow>{emptyText}</EmptyRow>;

  return (
    <div>
      {files.map((file) => {
        const fromClient = file.uploadedBy === "CLIENT";
        const origin = fromClient
          ? `Sent by ${file.uploader?.name ?? "the client"}`
          : `Shared by ${file.uploader?.name ?? "your team"}`;
        return (
          <div
            key={file.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-l2 px-3.5 py-[9px]"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <a href={`/api/files/${file.id}`} className="text-[13px] font-medium break-all">
                  {file.filename}
                </a>
                <Pill tone={fromClient ? "sky" : "slate"} className="px-1.5">
                  {origin}
                </Pill>
              </div>
              {file.note ? <div className="mt-0.5 text-[12.5px] text-mu">{file.note}</div> : null}
              <div className="mt-0.5 text-[11.5px] text-fa">
                {humanFileSize(file.sizeBytes)} · {relativeTime(file.createdAt)}
                {showProject && file.project ? (
                  <>
                    {" · "}
                    <Link href={`/projects/${file.project.id}`} className="text-fa hover:text-ac">
                      {file.project.name}
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-[12px]">
              <a href={`/api/files/${file.id}`}>Download</a>
              <ConfirmForm
                action={deleteFileAction}
                hidden={{ attachmentId: file.id }}
                confirmMessage={`Delete ${file.filename}? This removes the file for everyone.`}
                variant="subtle"
              >
                Delete
              </ConfirmForm>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The rounded file-type chip in front of portal file rows. */
function ExtChip({ filename, fromClient }: { filename: string; fromClient: boolean }) {
  return (
    <span
      className="grid size-9 place-items-center rounded-[11px] font-mono text-[10px] uppercase"
      style={
        fromClient
          ? { background: "var(--sky-b)", color: "var(--sky-f)" }
          : { background: "var(--chip)", color: "var(--mu)" }
      }
      aria-hidden
    >
      {extensionOf(filename)}
    </span>
  );
}

/**
 * Portal file rows (design 1f).
 *
 * - `compact`: overview "Recent files" — origin · size, time on the right
 * - `shared`: files from the team, with a Download link
 * - `sent`: the client's own uploads, which they may delete
 */
export function PortalFileList({
  files,
  mode,
  emptyText,
}: {
  files: FileListItem[];
  mode: "compact" | "shared" | "sent";
  emptyText: string;
}) {
  if (files.length === 0) {
    return <div className="border-t border-ln pt-3.5 pb-2.5 text-[14px] text-mu">{emptyText}</div>;
  }

  return (
    <div>
      {files.map((file) => {
        const fromClient = file.uploadedBy === "CLIENT";
        const origin = fromClient ? `Sent by ${file.uploader?.name ?? "you"}` : "Shared with you";
        const meta = [
          humanFileSize(file.sizeBytes),
          relativeTime(file.createdAt),
          file.project?.name ?? null,
        ]
          .filter(Boolean)
          .join(" · ");

        if (mode === "compact") {
          return (
            <div key={file.id} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 py-[7px]">
              <ExtChip filename={file.filename} fromClient={false} />
              <div className="min-w-0">
                <a href={`/api/files/${file.id}`} className="block truncate text-[14px] text-tx">
                  {file.filename}
                </a>
                <div className="text-[12px] text-fa">
                  {origin} · {humanFileSize(file.sizeBytes)}
                </div>
              </div>
              <span className="text-[12px] whitespace-nowrap text-fa">{relativeTime(file.createdAt)}</span>
            </div>
          );
        }

        return (
          <div
            key={file.id}
            className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 border-t border-ln py-2.5"
          >
            <ExtChip filename={file.filename} fromClient={mode === "sent"} />
            <div className="min-w-0">
              <a href={`/api/files/${file.id}`} className="block truncate text-[14px] font-medium">
                {file.filename}
              </a>
              {file.note ? <div className="text-[13px] text-mu">{file.note}</div> : null}
              <div className="text-[12px] text-fa">{meta}</div>
            </div>
            {mode === "sent" ? (
              <ConfirmForm
                action={deleteFileAction}
                hidden={{ attachmentId: file.id }}
                confirmMessage={`Delete ${file.filename}? This removes the file for everyone.`}
                variant="subtle"
                buttonTextClass="text-[13px]"
              >
                Delete
              </ConfirmForm>
            ) : (
              <a href={`/api/files/${file.id}`} className="text-[13px]">
                Download
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
