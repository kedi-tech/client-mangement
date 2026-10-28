import type { Metadata } from "next";
import Link from "next/link";

import { FileList } from "@/components/file-list";
import { FilterBar, FilterSelect } from "@/components/filters";
import { SearchInput } from "@/components/search-input";
import { UploadForm } from "@/components/upload-form";
import { Card, CardHeader, EmptyBox, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { humanFileSize, plural } from "@/lib/format";
import { like } from "@/lib/search";
import { requireUser } from "@/lib/session";
import { clientScope, viaClient } from "@/server/scope";
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_BYTES } from "@/lib/upload-rules";
import { uploadStaffFileAction } from "@/server/actions/files";

export const metadata: Metadata = { title: "Files" };

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function FilesPage({ searchParams }: { searchParams: SearchParams }) {
  // Any staff account may share a file with a client — admin, member or owner.
  const user = await requireUser();
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const clientId = params.clientId ?? "";
  const direction = params.direction ?? "";

  const where = {
    ...viaClient(user),
    ...(clientId ? { clientId } : {}),
    ...(direction ? { uploadedBy: direction } : {}),
    ...(q
      ? {
          OR: [{ filename: like(q) }, { note: like(q) }, { client: { name: like(q) } }],
        }
      : {}),
  };

  const [files, clients, projects] = await Promise.all([
    prisma.attachment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        uploader: { select: { name: true } },
        project: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
    }),
    prisma.client.findMany({ where: clientScope(user), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // Every project, so the form can narrow them once a client is chosen.
    prisma.project.findMany({
      where: viaClient(user),
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
  ]);

  const received = files.filter((file) => file.uploadedBy === "CLIENT");
  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);

  // Files are grouped by client, newest client activity first.
  const byClient = new Map<string, { name: string; files: typeof files }>();
  for (const file of files) {
    const entry = byClient.get(file.clientId) ?? { name: file.client.name, files: [] };
    entry.files.push(file);
    byClient.set(file.clientId, entry);
  }
  const filtered = Boolean(q || clientId || direction);

  return (
    <>
      <PageHeader
        title="Files"
        description={`${plural(files.length, "file")} · ${received.length} received from clients · ${humanFileSize(totalBytes)} stored`}
      />

      <div className="grid grid-cols-1 items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          <FilterBar>
            <SearchInput placeholder="Search filename, message, client" className="flex-[1_1_220px]" />
            <FilterSelect
              name="direction"
              label="Direction"
              allLabel="Both ways"
              options={[
                { value: "CLIENT", label: "Received from clients" },
                { value: "STAFF", label: "Shared by your team" },
              ]}
            />
            <FilterSelect
              name="clientId"
              label="Client"
              allLabel="All clients"
              options={clients.map((client) => ({ value: client.id, label: client.name }))}
            />
          </FilterBar>

          {byClient.size === 0 ? (
            <EmptyBox
              title={filtered ? "No files match those filters" : "No files yet"}
              description={
                filtered
                  ? "Try a different search or filter."
                  : "Share one here, or wait for a client to send you something through their portal."
              }
            />
          ) : (
            [...byClient.entries()].map(([id, group]) => (
              <Card key={id}>
                <CardHeader
                  title={
                    <Link href={`/clients/${id}`} className="text-tx hover:text-ac">
                      {group.name}
                    </Link>
                  }
                  action={<span className="text-fa">{plural(group.files.length, "file")}</span>}
                />
                <FileList files={group.files} />
              </Card>
            ))
          )}
        </div>

        <Card>
          <CardHeader title="Share a file with a client" />
          {clients.length === 0 ? (
            <div className="p-3.5 text-[13px] text-mu">Add a client first, then share files with them here.</div>
          ) : (
            <UploadForm
              action={uploadStaffFileAction}
              clients={clients}
              projects={projects}
              accept={ACCEPT_ATTRIBUTE}
              maxBytes={MAX_UPLOAD_BYTES}
              submitLabel="Share with client"
              layout="panel"
            />
          )}
        </Card>
      </div>
    </>
  );
}
