import type { Metadata } from "next";

import { BackLink, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { emptyClient } from "@/lib/form-defaults";
import { createClientAction } from "@/server/actions/clients";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireUser();

  return (
    <>
      <PageHeader
        title="New client"
        breadcrumb={
          <BackLink href={"/clients"}>Clients</BackLink>
        }
      />
      <ClientForm
        action={createClientAction}
        values={emptyClient}
        submitLabel="Create client"
        cancelHref="/clients"
      />
    </>
  );
}
