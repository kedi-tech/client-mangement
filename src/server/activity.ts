import "server-only";

import { prisma } from "@/lib/db";

/**
 * Append an entry to the activity feed. Deliberately non-fatal: a failure to
 * write history should never roll back the user's actual change.
 */
export async function logActivity(input: {
  type: string;
  message: string;
  actorId: string;
  clientId?: string | null;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  try {
    await prisma.activity.create({
      data: {
        type: input.type,
        message: input.message,
        actorId: input.actorId,
        clientId: input.clientId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    });
  } catch (error) {
    console.error("Failed to record activity", error);
  }
}
