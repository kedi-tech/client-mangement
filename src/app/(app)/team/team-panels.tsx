"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { ConfirmForm } from "@/components/confirm-form";
import {
  Badge,
  Button,
  CardHeader,
  Field,
  FormError,
  FormNotice,
  GridHead,
  GridTable,
  Input,
  Pill,
  Select,
} from "@/components/ui";
import { label } from "@/lib/constants";
import { generatePassword } from "@/lib/generate-password";
import type { FormState } from "@/lib/validation";
import {
  createTeamMemberAction,
  removeTeamMemberAction,
  resetTeamPasswordAction,
  updateTeamRoleAction,
} from "@/server/actions/team";

const COLS = "minmax(200px,1.5fr) 150px 170px 110px 170px";

export type TeamRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isSelf: boolean;
  /** Role dropdown is offered (outranked and not the last admin). */
  canChange: boolean;
  canReset: boolean;
  canRemove: boolean;
  /** Why the role is locked, shown under the badge. */
  reason: string;
  lastSeen: string;
  added: string;
};

type Flash = { text: string; error: boolean } | null;

function Submit({ label: text, className }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={className ?? "text-[12.5px]"}>
      {pending ? "Saving…" : text}
    </Button>
  );
}

function PasswordInput({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex gap-1.5">
      <Input
        id={id}
        name="password"
        type="text"
        size="sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        minLength={8}
        required
        autoComplete="off"
        spellCheck={false}
        className="flex-1 font-mono text-[12.5px]"
      />
      <Button variant="secondary" size="sm" className="py-[5px]" onClick={() => onChange(generatePassword())}>
        Generate
      </Button>
    </div>
  );
}

function AddForm({ roles, onDone }: { roles: string[]; onDone: (flash: Flash) => void }) {
  const [password, setPassword] = useState(generatePassword);
  const [state, formAction] = useActionState<FormState, FormData>(createTeamMemberAction, {});
  const nameRef = useRef("");

  useEffect(() => {
    if (state.ok) onDone({ text: `${nameRef.current} was added. Send them the temporary password.`, error: false });
  }, [state.ok, onDone]);

  const errors = state.fieldErrors ?? {};

  return (
    <form
      action={(formData) => {
        nameRef.current = String(formData.get("name") ?? "");
        formAction(formData);
      }}
      className="grid grid-cols-1 gap-3 border-b border-l2 bg-hov p-3.5 min-[720px]:grid-cols-2"
    >
      {state.error ? (
        <div className="col-span-full">
          <FormError message={state.error} />
        </div>
      ) : null}
      <Field label="Name" htmlFor="teamName" errors={errors.name} size="sm">
        <Input id="teamName" name="name" size="sm" required />
      </Field>
      <Field label="Email" htmlFor="teamEmail" errors={errors.email} size="sm">
        <Input id="teamEmail" name="email" type="email" size="sm" required />
      </Field>
      <Field
        label="Role"
        htmlFor="teamRole"
        errors={errors.role}
        size="sm"
        hint="Admins can add and remove members. Members have full access to client data but cannot change accounts."
      >
        <Select id="teamRole" name="role" size="sm" defaultValue={roles[roles.length - 1]}>
          {roles.map((role) => (
            <option key={role} value={role}>
              {label(role)}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Temporary password"
        htmlFor="teamPassword"
        errors={errors.password}
        size="sm"
        hint="Send this over a channel you trust. Setting a password signs the account out of every device."
      >
        <PasswordInput id="teamPassword" value={password} onChange={setPassword} />
      </Field>
      <div className="col-span-full flex gap-2">
        <Submit label="Add teammate" />
        <Button variant="secondary" className="text-[12.5px]" onClick={() => onDone(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Role dropdown that saves as soon as it changes. */
function RoleSelect({
  row,
  roles,
  onResult,
}: {
  row: TeamRow;
  roles: string[];
  onResult: (flash: Flash) => void;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(updateTeamRoleAction, {});
  const chosen = useRef(row.role);

  useEffect(() => {
    if (state.error) onResult({ text: state.error, error: true });
    else if (state.ok) {
      onResult({ text: `${row.name} is now ${label(chosen.current)} and was signed out everywhere.`, error: false });
    }
  }, [state, onResult, row.name]);

  const options = roles.includes(row.role) ? roles : [row.role, ...roles];

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={row.id} />
      <select
        name="role"
        aria-label={`Role for ${row.name}`}
        defaultValue={row.role}
        onChange={(event) => {
          chosen.current = event.currentTarget.value;
          event.currentTarget.form?.requestSubmit();
        }}
        className="rounded-[4px] border border-inpb bg-inp px-1.5 py-1 text-[12.5px] text-tx"
      >
        {options.map((value) => (
          <option key={value} value={value}>
            {label(value)}
          </option>
        ))}
      </select>
    </form>
  );
}

function ResetForm({ row, onDone }: { row: TeamRow; onDone: (flash: Flash) => void }) {
  const [password, setPassword] = useState(generatePassword);
  const [state, formAction] = useActionState<FormState, FormData>(resetTeamPasswordAction, {});

  useEffect(() => {
    if (state.ok) onDone({ text: `Password updated. ${row.name} was signed out everywhere.`, error: false });
    else if (state.error) onDone({ text: state.error, error: true });
  }, [state, onDone, row.name]);

  return (
    <form
      action={formAction}
      className="mx-3.5 mb-3 flex flex-wrap items-center gap-2 rounded-[4px] bg-hov p-2.5"
    >
      <input type="hidden" name="userId" value={row.id} />
      <div className="min-w-[220px] flex-1">
        <PasswordInput id={`team-reset-${row.id}`} value={password} onChange={setPassword} />
      </div>
      <Submit label="Set password" className="px-2.5 py-[5px] text-[12px]" />
      <span className="basis-full text-[11.5px] text-mu">
        {state.fieldErrors?.password?.[0] ?? `Signs ${row.name.split(" ")[0]} out of every device.`}
      </span>
    </form>
  );
}

/** The whole Team panel: header, add form, staff rows and status messages. */
export function TeamPanel({ rows, assignable }: { rows: TeamRow[]; assignable: string[] }) {
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);

  return (
    <>
      <CardHeader
        title={`${rows.length} ${rows.length === 1 ? "teammate" : "teammates"}`}
        action={
          assignable.length > 0 ? (
            <Button
              size="sm"
              className="px-2.5 py-1 text-[12.5px]"
              onClick={() => {
                setAdding((value) => !value);
                setFlash(null);
              }}
            >
              Add teammate
            </Button>
          ) : null
        }
      />
      {adding ? (
        <AddForm
          roles={assignable}
          onDone={(result) => {
            setAdding(false);
            setFlash(result);
          }}
        />
      ) : null}

      <GridTable minWidth={760}>
        <GridHead cols={COLS}>
          <span>Name</span>
          <span>Role</span>
          <span>Last sign-in</span>
          <span>Added</span>
          <span />
        </GridHead>
        {rows.map((row) => (
          <div key={row.id} className="border-b border-l2">
            <div className="grid items-center gap-3 px-3.5 py-2.5 text-[13px]" style={{ gridTemplateColumns: COLS }}>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-medium">
                  {row.name}
                  {row.isSelf ? (
                    <Pill accent className="px-[5px] text-[10.5px]">
                      You
                    </Pill>
                  ) : null}
                </span>
                <span className="block truncate text-[12px] text-fa">{row.email}</span>
              </span>
              <span>
                {row.canChange ? (
                  <RoleSelect row={row} roles={assignable} onResult={setFlash} />
                ) : (
                  <span className="flex flex-col items-start gap-0.5">
                    <Badge value={row.role} />
                    <span className="text-[11.5px] text-fa">{row.reason}</span>
                  </span>
                )}
              </span>
              <span className="text-[12.5px] text-mu">{row.lastSeen}</span>
              <span className="text-[12.5px] text-mu">{row.added}</span>
              <span className="flex items-center justify-end gap-3 text-[12px]">
                {row.canReset ? (
                  <Button
                    variant="link"
                    onClick={() => {
                      setResetFor((current) => (current === row.id ? null : row.id));
                      setFlash(null);
                    }}
                  >
                    Reset password
                  </Button>
                ) : null}
                {row.canRemove ? (
                  <ConfirmForm
                    action={removeTeamMemberAction}
                    hidden={{ userId: row.id }}
                    confirmMessage={`Remove ${row.name}? They will be signed out and lose access immediately. Their notes and activity history are kept.`}
                    variant="subtle"
                  >
                    Remove
                  </ConfirmForm>
                ) : null}
              </span>
            </div>
            {resetFor === row.id ? (
              <ResetForm
                row={row}
                onDone={(result) => {
                  setResetFor(null);
                  setFlash(result);
                }}
              />
            ) : null}
          </div>
        ))}
      </GridTable>

      {flash ? (
        <div className="px-3.5 py-[9px]">
          {flash.error ? (
            <span className="text-[12.5px] text-red" role="alert">
              {flash.text}
            </span>
          ) : (
            <FormNotice message={flash.text} />
          )}
        </div>
      ) : null}
    </>
  );
}
