"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

import { Field, FormError, buttonClass, controlClass } from "@/components/ui";
import { humanFileSize } from "@/lib/format";
import type { FormState } from "@/lib/validation";

const TYPES_HINT = "Documents, spreadsheets, presentations, PDFs, images, text, CSV, JSON and ZIP.";

function Submit({ label, portal }: { label: string; portal: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        portal
          ? "rounded-[14px] border-0 bg-ac px-[18px] py-[11px] text-[14px] font-medium text-white disabled:opacity-60"
          : buttonClass("primary", "md", "text-[12.5px]")
      }
    >
      {pending ? "Uploading…" : label}
    </button>
  );
}

/**
 * Upload form shared by the staff client page, the workspace-wide Files page and
 * the client portal. The action decides which side the file is attributed to;
 * the portal action ignores any client id in the form and uses the session.
 *
 * Layouts follow the designs:
 * - `inline`: two-column strip at the foot of a client's Files panel
 * - `panel`: the stacked "Share a file with a client" side panel (asks for a client)
 * - `portal`: the soft "Send us a file" card in the client portal
 */
export function UploadForm({
  action,
  clientId,
  clients,
  projects,
  accept,
  maxBytes,
  submitLabel = "Upload file",
  layout = "inline",
  successMessage = "Upload complete.",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  clientId?: string;
  clients?: { id: string; name: string }[];
  projects: { id: string; name: string; clientId?: string }[];
  accept: string;
  maxBytes: number;
  submitLabel?: string;
  layout?: "inline" | "panel" | "portal";
  successMessage?: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [picked, setPicked] = useState<{ text: string; error: boolean } | null>(null);
  const [chosenClient, setChosenClient] = useState(clientId ?? "");
  const portal = layout === "portal";

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setPicked(null);
      setChosenClient(clientId ?? "");
    }
  }, [state.ok, clientId]);

  // A project may only be attached to a file filed under its own client — the
  // server re-checks this, so the filter is about not offering a doomed choice.
  const availableProjects = clients
    ? projects.filter((project) => project.clientId === chosenClient)
    : projects;

  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return setPicked(null);
    if (file.size > maxBytes) {
      return setPicked({ text: `That file is larger than ${humanFileSize(maxBytes)}.`, error: true });
    }
    setPicked({ text: `${file.name} · ${humanFileSize(file.size)}`, error: false });
  };

  const pickedLine = picked ? (
    <span className={cn("font-normal", portal ? "text-[13px]" : "text-[12px]", picked.error ? "text-red" : "text-mu")}>
      {picked.text}
    </span>
  ) : null;

  const fileInput = (
    <input
      id="file"
      name="file"
      type="file"
      accept={accept}
      required
      onChange={onPick}
      className={portal ? "text-[13px]" : "text-[12.5px]"}
    />
  );

  const projectSelect = (
    <select
      id="projectId"
      name="projectId"
      defaultValue=""
      className={
        portal
          ? "rounded-[12px] border border-inpb bg-inp px-3 py-[9px] text-[14px] text-tx"
          : controlClass("sm", "px-2")
      }
    >
      <option value="">No project</option>
      {availableProjects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </select>
  );

  const success = state.ok ? (
    <div role="status" className={cn("text-grn", portal ? "text-[13px]" : "text-[12.5px]")}>
      {successMessage}
    </div>
  ) : null;

  if (portal) {
    return (
      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col gap-3.5 rounded-[20px] bg-card p-[22px] shadow-soft"
      >
        <h2 className="m-0 text-[17px] font-semibold">Send us a file</h2>
        {state.error ? (
          <div
            role="alert"
            className="rounded-[12px] px-3.5 py-2.5 text-[13.5px]"
            style={{ background: "var(--rose-b)", color: "var(--rose-f)" }}
          >
            {state.error}
          </div>
        ) : null}
        <label className="flex cursor-pointer flex-col gap-2 rounded-[14px] border-[1.5px] border-dashed border-inpb p-[18px] text-[13.5px] text-mu">
          Choose a file (up to {humanFileSize(maxBytes)})
          {fileInput}
          {pickedLine}
        </label>
        {projects.length > 0 ? (
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Project (optional)
            {projectSelect}
          </label>
        ) : null}
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Message (optional)
          <textarea
            name="note"
            rows={3}
            maxLength={500}
            placeholder="Anything we should know about this file?"
            className="resize-y rounded-[12px] border border-inpb bg-inp px-3 py-[9px] text-[14px] text-tx"
          />
        </label>
        <Submit label={submitLabel} portal />
        {success}
      </form>
    );
  }

  if (layout === "panel") {
    return (
      <form ref={formRef} action={formAction} className="flex flex-col gap-2.5 p-3.5">
        <FormError message={state.error} />
        {clients ? (
          <Field label="Client" htmlFor="uploadClientId" required size="sm">
            <select
              id="uploadClientId"
              name="clientId"
              required
              value={chosenClient}
              onChange={(event) => setChosenClient(event.target.value)}
              className={controlClass("sm", "px-2")}
            >
              <option value="">Choose a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <input type="hidden" name="clientId" value={clientId} />
        )}
        <Field label="Project (optional)" htmlFor="projectId" size="sm">
          {projectSelect}
        </Field>
        <Field label="File" htmlFor="file" size="sm">
          {fileInput}
          {pickedLine}
        </Field>
        <Field label="Message (optional)" htmlFor="note" size="sm">
          <textarea id="note" name="note" rows={2} maxLength={500} className={controlClass("sm", "resize-y")} />
        </Field>
        <div className="text-[11.5px] text-fa">
          Up to {humanFileSize(maxBytes)}. {TYPES_HINT}
        </div>
        <div>
          <Submit label={submitLabel} portal={false} />
        </div>
        {success}
      </form>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid grid-cols-1 gap-2.5 bg-hov px-3.5 py-3 min-[720px]:grid-cols-2"
    >
      {clientId ? <input type="hidden" name="clientId" value={clientId} /> : null}
      {state.error ? (
        <div className="col-span-full">
          <FormError message={state.error} />
        </div>
      ) : null}
      <Field label="File" htmlFor="file" size="sm">
        {fileInput}
        {pickedLine}
      </Field>
      <Field label="Project (optional)" htmlFor="projectId" size="sm">
        {projectSelect}
      </Field>
      <Field label="Message (optional)" htmlFor="note" size="sm" className="col-span-full">
        <input id="note" name="note" maxLength={500} placeholder="What is this file for?" className={controlClass("sm")} />
      </Field>
      <div className="col-span-full flex flex-wrap items-center gap-3">
        <Submit label={submitLabel} portal={false} />
        {success}
      </div>
    </form>
  );
}
