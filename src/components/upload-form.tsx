"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, FormError, Input, Select } from "@/components/ui";

import { humanFileSize } from "@/lib/format";
import type { FormState } from "@/lib/validation";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Uploading…" : label}
    </Button>
  );
}

/**
 * Upload form shared by the staff client page, the workspace-wide Files page and
 * the client portal. The action decides which side the file is attributed to;
 * the portal action ignores any client id in the form and uses the session.
 *
 * Pass `clientId` when the client is already known (a client's own page), or
 * `clients` to have the form ask — which is what the Files page needs, since it
 * spans every client.
 */
export function UploadForm({
  action,
  clientId,
  clients,
  projects,
  accept,
  maxBytes,
  submitLabel = "Upload file",
  defaultProjectId = "",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  clientId?: string;
  /** When given, the form asks which client the file belongs to. */
  clients?: { id: string; name: string }[];
  /** `clientId` is only needed when the form picks the client itself. */
  projects: { id: string; name: string; clientId?: string }[];
  accept: string;
  maxBytes: number;
  submitLabel?: string;
  defaultProjectId?: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState<{ name: string; size: number } | null>(null);
  const [tooLarge, setTooLarge] = useState(false);
  const [chosenClient, setChosenClient] = useState(clientId ?? "");

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setSelected(null);
      setTooLarge(false);
      setChosenClient(clientId ?? "");
    }
  }, [state.ok, clientId]);

  // A project may only be attached to a file filed under its own client — the
  // server re-checks this, so the filter is about not offering a doomed choice.
  const availableProjects = clients
    ? projects.filter((project) => project.clientId === chosenClient)
    : projects;

  return (
    <form ref={formRef} action={formAction} className="space-y-4 px-5 py-5">
      {clientId && !clients ? <input type="hidden" name="clientId" value={clientId} /> : null}
      <FormError message={state.error} />
      {tooLarge ? (
        <FormError message={`That file is larger than ${humanFileSize(maxBytes)}.`} />
      ) : null}
      {state.ok ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          Upload complete.
        </p>
      ) : null}

      {clients ? (
        <Field label="Client" htmlFor="uploadClientId" required>
          <Select
            id="uploadClientId"
            name="clientId"
            required
            value={chosenClient}
            onChange={(event) => setChosenClient(event.target.value)}
          >
            <option value="">Choose a client…</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field
        label="File"
        htmlFor="file"
        hint={`Up to ${humanFileSize(maxBytes)}. Documents, spreadsheets, PDFs, images, text, CSV and ZIP.`}
        required
      >
        <Input
          id="file"
          name="file"
          type="file"
          accept={accept}
          required
          onChange={(event) => {
            const file = event.target.files?.[0];
            setSelected(file ? { name: file.name, size: file.size } : null);
            setTooLarge(Boolean(file && file.size > maxBytes));
          }}
          className="file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 dark:file:bg-slate-800 dark:file:text-slate-200"
        />
      </Field>

      {selected ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {selected.name} · {humanFileSize(selected.size)}
        </p>
      ) : null}

      {availableProjects.length > 0 ? (
        <Field label="Related project" htmlFor="projectId" hint="Optional.">
          <Select id="projectId" name="projectId" defaultValue={defaultProjectId}>
            <option value="">No specific project</option>
            {availableProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label="Message" htmlFor="note" hint="Optional — a line of context.">
        <Input id="note" name="note" maxLength={500} placeholder="Signed contract, page 3 updated…" />
      </Field>

      <Submit label={submitLabel} />
    </form>
  );
}
