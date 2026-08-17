"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { getCurrentUser, requirePortalUser, requireUser } from "@/lib/session";
import { deleteUpload, saveUpload } from "@/lib/storage";
import type { FormState } from "@/lib/validation";
import { logActivity } from "@/server/activity";

const MAX_NOTE_LENGTH = 500;

function readNote(formData: FormData): string | null {
  const note = String(formData.get("note") ?? "").trim();
  return note === "" ? null : note.slice(0, MAX_NOTE_LENGTH);
}

/** The project must belong to the client the file is filed under. */
async function validProjectId(clientId: string, projectId: string): Promise<string | null> {
  if (!projectId) return null;
  const project = await prisma.project.findFirst({
    where: { id: projectId, clientId },
    select: { id: true },
  });
  return project?.id ?? null;
}

/** Staff upload: a deliverable, contract or anything else for the client to see. */
export async function uploadStaffFileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const clientId = String(formData.get("clientId") ?? "");
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true },
  });
  if (!client) return { error: "That client no longer exists." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a file to upload." };

  const saved = await saveUpload(file);
  if ("error" in saved) return { error: saved.error };

  const attachment = await prisma.attachment.create({
    data: {
      ...saved,
      clientId: client.id,
      projectId: await validProjectId(client.id, String(formData.get("projectId") ?? "")),
      uploadedBy: "STAFF",
      uploaderId: user.id,
      note: readNote(formData),
    },
  });

  await logActivity({
    type: "FILE_SHARED",
    message: `${attachment.filename} was shared with ${client.name}`,
    actorId: user.id,
    clientId: client.id,
    entityType: "Attachment",
    entityId: attachment.id,
  });

  revalidatePath(`/clients/${client.id}`);
  revalidatePath("/files");
  return { ok: true };
}

/** Portal upload: the client sends a file to your team. */
export async function uploadClientFileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePortalUser();

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a file to upload." };

  const saved = await saveUpload(file);
  if ("error" in saved) return { error: saved.error };

  // The client id comes from the session, never from the form.
  const attachment = await prisma.attachment.create({
    data: {
      ...saved,
      clientId: user.clientId,
      projectId: await validProjectId(user.clientId, String(formData.get("projectId") ?? "")),
      uploadedBy: "CLIENT",
      uploaderId: user.id,
      note: readNote(formData),
    },
  });

  await logActivity({
    type: "FILE_RECEIVED",
    message: `${user.name} uploaded ${attachment.filename} through the portal`,
    actorId: user.id,
    clientId: user.clientId,
    entityType: "Attachment",
    entityId: attachment.id,
  });

  revalidatePath("/portal/files");
  revalidatePath("/portal");
  revalidatePath(`/clients/${user.clientId}`);
  revalidatePath("/files");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Delete a file. Staff may delete anything; a portal user may only withdraw a
 * file they uploaded themselves.
 */
export async function deleteFileAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const attachment = await prisma.attachment.findUnique({
    where: { id: String(formData.get("attachmentId") ?? "") },
  });
  if (!attachment) return;

  const isPortal = user.role === "CLIENT";
  if (isPortal) {
    const ownFile =
      attachment.clientId === user.clientId && attachment.uploadedBy === "CLIENT";
    if (!ownFile) return;
  }

  await prisma.attachment.delete({ where: { id: attachment.id } });
  await deleteUpload(attachment.storedName);

  revalidatePath(`/clients/${attachment.clientId}`);
  revalidatePath("/files");
  revalidatePath("/portal/files");
  revalidatePath("/portal");
}
