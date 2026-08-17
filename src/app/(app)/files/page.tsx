import type { Metadata } from "next";
import Link from "next/link";

import { FileList } from "@/components/file-list";
import { FilterSelect } from "@/components/filters";
import { SearchInput } from "@/components/search-input";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { humanFileSize } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Files" };

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function FilesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const clientId = params.clientId ?? "";
  const direction = params.direction ?? "";

  const where = {
    ...(clientId ? { clientId } : {}),
    ...(direction ? { uploadedBy: direction } : {}),
    ...(q
      ? {
          OR: [
            { filename: { contains: q } },
            { note: { contains: q } },
            { client: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [files, clients] = await Promise.all([
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
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const received = files.filter((file) => file.uploadedBy === "CLIENT");
  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);

  // The shared list renders one client's files; here the client is worth naming,
  // so files are grouped by client.
  const byClient = new Map<string, { name: string; files: typeof files }>();
  for (const file of files) {
    const entry = byClient.get(file.clientId) ?? { name: file.client.name, files: [] };
    entry.files.push(file);
    byClient.set(file.clientId, entry);
  }

  return (
    <>
      <PageHeader
        title="Files"
        description={`${files.length} files · ${received.length} received from clients · ${humanFileSize(totalBytes)} stored`}
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="min-w-56 flex-1">
            <SearchInput placeholder="Search filename, message, client…" />
          </div>
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
        </div>
      </Card>

      {byClient.size === 0 ? (
        <Card>
          <FileList
            files={[]}
            perspective="staff"
            emptyTitle="No files match those filters"
            emptyDescription="Files are uploaded from a client's page, or sent to you through their portal."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {[...byClient.entries()].map(([id, group]) => (
            <Card key={id}>
              <CardHeader
                title={
                  <Link href={`/clients/${id}`} className="hover:text-indigo-600 hover:underline">
                    {group.name}
                  </Link>
                }
                description={`${group.files.length} files`}
              />
              <FileList files={group.files} perspective="staff" />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
