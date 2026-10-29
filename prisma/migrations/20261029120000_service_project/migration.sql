-- Domains and hosting belong to a project. The table is empty at this point,
-- so the column can be required straight away.
-- AlterTable
ALTER TABLE "Service" ADD COLUMN "projectId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Service_projectId_idx" ON "Service"("projectId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
