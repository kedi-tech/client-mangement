"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";

import { FormSubmit } from "@/app/(app)/form-submit";
import {
  Button,
  Field,
  FormActions,
  FormError,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Textarea,
  formPanelClass,
} from "@/components/ui";
import { TASK_PRIORITIES, TASK_STATUSES, label } from "@/lib/constants";
import type { SelectOption, TaskFormValues } from "@/lib/form-defaults";
import type { FormState } from "@/lib/validation";

/** Shared field set — the project list narrows to the selected client. */
function TaskFields({
  values,
  errors,
  clients,
  projects,
  users,
  size,
}: {
  values: TaskFormValues;
  errors: Record<string, string[]>;
  clients: SelectOption[];
  projects: SelectOption[];
  users: SelectOption[];
  size: "sm" | "md";
}) {
  const [clientId, setClientId] = useState(values.clientId);
  const visibleProjects = clientId
    ? projects.filter((project) => project.clientId === clientId)
    : projects;

  return (
    <>
      <Field label="Title" htmlFor="title" errors={errors.title} required size={size} className="col-span-full">
        <Input id="title" name="title" size={size} defaultValue={values.title} required maxLength={200} />
      </Field>
      <Field label="Status" htmlFor="status" errors={errors.status} size={size}>
        <Select id="status" name="status" defaultValue={values.status} size={size}>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {label(status)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Priority" htmlFor="priority" errors={errors.priority} size={size}>
        <Select id="priority" name="priority" defaultValue={values.priority} size={size}>
          {TASK_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {label(priority)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Due date" htmlFor="dueDate" errors={errors.dueDate} size={size}>
        <Input id="dueDate" name="dueDate" type="date" size={size} defaultValue={values.dueDate} />
      </Field>
      <Field label="Client" htmlFor="clientId" errors={errors.clientId} size={size}>
        <Select
          id="clientId"
          name="clientId"
          size={size}
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
        size={size}
        hint="Picking a project sets the client automatically."
      >
        <Select id="projectId" name="projectId" size={size} defaultValue={values.projectId}>
          <option value="">No project</option>
          {visibleProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Assignee" htmlFor="assigneeId" errors={errors.assigneeId} size={size}>
        <Select id="assigneeId" name="assigneeId" size={size} defaultValue={values.assigneeId}>
          <option value="">Unassigned</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Description"
        htmlFor="description"
        errors={errors.description}
        size={size}
        className="col-span-full"
      >
        <Textarea
          id="description"
          name="description"
          size={size}
          rows={size === "sm" ? 2 : 3}
          defaultValue={values.description}
        />
      </Field>
    </>
  );
}

/**
 * Tasks page header with its "New task" button. The create panel opens below
 * the header, above the filters, as in the design.
 */
export function TasksHeader({
  description,
  descriptionWarn,
  action,
  clients,
  projects,
  users,
  defaults,
}: {
  description: ReactNode;
  descriptionWarn: boolean;
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

  return (
    <>
      <PageHeader
        title="Tasks"
        description={<span className={descriptionWarn ? "text-red" : undefined}>{description}</span>}
        actions={<Button onClick={() => setOpen((value) => !value)}>New task</Button>}
      />
      {open ? (
        <form ref={formRef} action={formAction} className={formPanelClass(3, "gap-3 p-4")}>
          {state.error ? (
            <div className="col-span-full">
              <FormError message={state.error} />
            </div>
          ) : null}
          <TaskFields
            values={defaults}
            errors={state.fieldErrors ?? {}}
            clients={clients}
            projects={projects}
            users={users}
            size="sm"
          />
          <FormActions>
            <FormSubmit>Create task</FormSubmit>
            <Button variant="secondary" className="text-[12.5px]" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </FormActions>
        </form>
      ) : null}
    </>
  );
}

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
    <form action={formAction} className={formPanelClass(3, "max-w-[860px]")}>
      {state.error ? (
        <div className="col-span-full">
          <FormError message={state.error} />
        </div>
      ) : null}
      <TaskFields
        values={values}
        errors={state.fieldErrors ?? {}}
        clients={clients}
        projects={projects}
        users={users}
        size="md"
      />
      <FormActions>
        <FormSubmit>Save task</FormSubmit>
        <LinkButton href={cancelHref} variant="secondary" size="lg">
          Cancel
        </LinkButton>
      </FormActions>
    </form>
  );
}
