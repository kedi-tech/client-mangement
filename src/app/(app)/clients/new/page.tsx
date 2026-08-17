import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { emptyClient } from "@/lib/form-defaults";
import { createClientAction } from "@/server/actions/clients";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  const user = await requireUser();
  const owners = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New client"
        description="Add a company to your workspace."
        breadcrumb={
          <Link href="/clients" className="hover:text-indigo-600 hover:underline">
            ← Clients
          </Link>
        }
      />
      <ClientForm
        action={createClientAction}
        values={{ ...emptyClient, ownerId: user.id }}
        owners={owners}
        submitLabel="Create client"
        cancelHref="/clients"
      />
    </div>
  );
}
