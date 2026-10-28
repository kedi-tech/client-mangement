import type { Metadata } from "next";

import { PortalFileList } from "@/components/file-list";
import { PortalCard, PortalHero, PortalMain } from "@/components/portal-ui";
import { UploadForm } from "@/components/upload-form";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/format";
import { requirePortalUser } from "@/lib/session";
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_BYTES } from "@/lib/upload-rules";
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
      <PortalHero title="Files" sub="Everything we have shared, and everything you have sent us." />
      <PortalMain>
        <div className="grid grid-cols-1 items-start gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            <PortalCard raised className="pb-3">
              <h2 className="m-0 mb-0.5 text-[17px] font-semibold">Shared with you</h2>
              <div className="mb-2 text-[13px] text-fa">{plural(fromUs.length, "file")}</div>
              <PortalFileList files={fromUs} mode="shared" emptyText="Nothing shared with you yet." />
            </PortalCard>
            <PortalCard className="pb-3">
              <h2 className="m-0 mb-0.5 text-[17px] font-semibold">Files you sent</h2>
              <div className="mb-2 text-[13px] text-fa">
                {plural(fromClient.length, "file")} · you can remove your own uploads
              </div>
              <PortalFileList files={fromClient} mode="sent" emptyText="You haven't sent anything yet." />
            </PortalCard>
          </div>
          <UploadForm
            action={uploadClientFileAction}
            projects={projects}
            accept={ACCEPT_ATTRIBUTE}
            maxBytes={MAX_UPLOAD_BYTES}
            submitLabel="Send file"
            layout="portal"
            successMessage="Sent. Your team can see it now."
          />
        </div>
      </PortalMain>
    </>
  );
}
