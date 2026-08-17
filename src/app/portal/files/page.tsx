import type { Metadata } from "next";

import { FileList } from "@/components/file-list";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { UploadForm } from "@/components/upload-form";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/format";
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_BYTES } from "@/lib/upload-rules";
import { requirePortalUser } from "@/lib/session";
import { uploadClientFileAction } from "@/server/actions/files";

export const metadata: Metadata = { title: "Files" };

export default async function PortalFilesPage() {
  const user = await requirePortalUser();

  const [files, projects] = await Promise.all([
    prisma.attachment.findMany({
      where: { clientId: user.clientId },
      orderBy: { createdAt: "desc" },
      include: {
        uploader: { select: { name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.project.findMany({
      where: { clientId: user.clientId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const fromUs = files.filter((file) => file.uploadedBy === "STAFF");
  const fromClient = files.filter((file) => file.uploadedBy === "CLIENT");

  return (
    <>
      <PageHeader
        title="Files"
        description="Send us documents, and pick up anything we have shared with you."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Shared with you" description={plural(fromUs.length, "file")} />
            <FileList
              files={fromUs}
              perspective="portal"
              emptyTitle="Nothing shared yet"
              emptyDescription="Deliverables and documents we send you will appear here."
            />
          </Card>

          <Card>
            <CardHeader
              title="Files you sent"
              description={`${plural(fromClient.length, "file")} · you can remove your own uploads`}
            />
            <FileList
              files={fromClient}
              perspective="portal"
              emptyTitle="You haven't sent anything yet"
              emptyDescription="Use the upload panel to send us a document."
            />
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Send us a file" description="We'll be notified in your account timeline." />
          <UploadForm
            action={uploadClientFileAction}
            projects={projects}
            accept={ACCEPT_ATTRIBUTE}
            maxBytes={MAX_UPLOAD_BYTES}
            submitLabel="Send file"
          />
        </Card>
      </div>
    </>
  );
}
