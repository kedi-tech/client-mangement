"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Card, CardHeader, Field, FormError, Input, Select, Textarea } from "@/components/ui";
import { TASK_PRIORITIES, TASK_STATUSES, label } from "@/lib/constants";
import type { SelectOption, TaskFormValues } from "@/lib/form-defaults";
import type { FormState } from "@/lib/validation";

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : children}
    </Button>
  );
}

/** Shared field set — the project list narrows to the selected client. */
function TaskFields({
  values,
  errors,
  clients,
  projects,
  users,
}: {
  values: TaskFormValues;
  errors: Record<string, string[]>;
  clients: SelectOption[];
  projects: SelectOption[];
  users: SelectOption[];
}) {
  const [clientId, setClientId] = useState(values.clientId);
  const visibleProjects = clientId
    ? projects.filter((project) => project.clientId === clientId)
    : projects;

  return (
    <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
      <Field label="Title" htmlFor="title" errors={errors.title} required className="sm:col-span-2">
        <Input id="title" name="title" defaultValue={values.title} required maxLength={200} />
      </Field>

      <Field label="Status" htmlFor="status" errors={errors.status}>
        <Select id="status" name="status" defaultValue={values.status}>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {label(status)}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Priority" htmlFor="priority" errors={errors.priority}>
        <Select id="priority" name="priority" defaultValue={values.priority}>
          {TASK_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {label(priority)}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Client" htmlFor="clientId" errors={errors.clientId}>
        <Select
          id="clientId"
          name="clientId"
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
        >
          <option value="">No client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Project"
        htmlFor="projectId"
        errors={errors.projectId}
        hint="Picking a project sets the client automatically."
      >
        <Select id="projectId" name="projectId" defaultValue={values.projectId}>
          <option value="">No project</option>
          {visibleProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Assignee" htmlFor="assigneeId" errors={errors.assigneeId}>
        <Select id="assigneeId" name="assigneeId" defaultValue={values.assigneeId}>
          <option value="">Unassigned</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Due date" htmlFor="dueDate" errors={errors.dueDate}>
        <Input id="dueDate" name="dueDate" type="date" defaultValue={values.dueDate} />
      </Field>

      <Field
        label="Description"
        htmlFor="description"
        errors={errors.description}
        className="sm:col-span-2"
      >
        <Textarea id="description" name="description" rows={3} defaultValue={values.description} />
      </Field>
    </div>
  );
}

/** Collapsible creator that sits at the top of the task list. */
export function NewTaskPanel({
  action,
  clients,
  projects,
  users,
  defaults,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  clients: SelectOption[];
  projects: SelectOption[];
  users: SelectOption[];
  defaults: TaskFormValues;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.ok]);

  if (!open) {
    return <Button onClick={() => setOpen(true)}>New task</Button>;
  }

  return (
    <Card className="mb-6">
      <CardHeader
        title="New task"
        action={
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Close
          </button>
        }
      />
      <form ref={formRef} action={formAction}>
        {state.error ? (
          <div className="px-5 pt-4">
            <FormError message={state.error} />
          </div>
        ) : null}
        <TaskFields
          values={defaults}
          errors={state.fieldErrors ?? {}}
          clients={clients}
          projects={projects}
          users={users}
        />
        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <Submit>Create task</Submit>
        </div>
      </form>
    </Card>
  );
}

/** Full-page editor used by /tasks/[id]/edit. */
export function EditTaskForm({
  action,
  values,
  clients,
  projects,
  users,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  values: TaskFormValues;
  clients: SelectOption[];
  projects: SelectOption[];
  users: SelectOption[];
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />
      <Card>
        <CardHeader title="Task details" />
        <TaskFields
          values={values}
          errors={state.fieldErrors ?? {}}
          clients={clients}
          projects={projects}
          users={users}
        />
      </Card>
      <div className="flex items-center gap-3">
        <Submit>Save changes</Submit>
        <Link
          href={cancelHref}
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
