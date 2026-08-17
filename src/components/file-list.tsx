import Link from "next/link";

import { ConfirmForm } from "@/components/confirm-form";
import { EmptyState } from "@/components/ui";
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

function FileIcon({ mimeType }: { mimeType: string }) {
  const isImage = mimeType.startsWith("image/");
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-5">
        {isImage ? (
          <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="1.5" />
            <path d="M21 16l-5-5-6 6" />
          </>
        ) : (
          <>
            <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
            <path d="M14 3v5h5" />
          </>
        )}
      </svg>
    </span>
  );
}

/**
 * Shared file list. `perspective` decides the wording and who may delete:
 * staff see everything and can remove anything, a portal user can only withdraw
 * their own uploads.
 */
export function FileList({
  files,
  perspective,
  showProject = true,
  emptyTitle = "No files yet",
  emptyDescription,
}: {
  files: FileListItem[];
  perspective: "staff" | "portal";
  showProject?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (files.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {files.map((file) => {
        const fromClient = file.uploadedBy === "CLIENT";
        const origin =
          perspective === "staff"
            ? fromClient
              ? `Sent by ${file.uploader?.name ?? "the client"}`
              : `Shared by ${file.uploader?.name ?? "your team"}`
            : fromClient
              ? `Sent by ${file.uploader?.name ?? "you"}`
              : "Shared with you";

        const canDelete = perspective === "staff" || fromClient;

        return (
          <li key={file.id} className="flex items-start gap-3 px-5 py-3">
            <FileIcon mimeType={file.mimeType} />

            <div className="min-w-0 flex-1">
              <a
                href={`/api/files/${file.id}`}
                className="text-sm font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
              >
                {file.filename}
              </a>
              {file.note ? (
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{file.note}</p>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span
                  className={
                    fromClient
                      ? "rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
                      : "rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }
                >
                  {origin}
                </span>
                <span>{humanFileSize(file.sizeBytes)}</span>
                <span>{relativeTime(file.createdAt)}</span>
                {showProject && file.project ? (
                  perspective === "staff" ? (
                    <Link
                      href={`/projects/${file.project.id}`}
                      className="hover:text-indigo-600 hover:underline"
                    >
                      {file.project.name}
                    </Link>
                  ) : (
                    <span>{file.project.name}</span>
                  )
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <a
                href={`/api/files/${file.id}`}
                className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Download
              </a>
              {canDelete ? (
                <ConfirmForm
                  action={deleteFileAction}
                  hidden={{ attachmentId: file.id }}
                  confirmMessage={`Delete ${file.filename}? This removes the file for everyone.`}
                  variant="subtle"
                >
                  Delete
                </ConfirmForm>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
