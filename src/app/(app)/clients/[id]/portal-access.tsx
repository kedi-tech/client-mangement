"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { ConfirmForm } from "@/components/confirm-form";
import { Button, CardHeader, Field, FormError, FormNotice, Input, Pill } from "@/components/ui";
import { generatePassword } from "@/lib/generate-password";
import type { FormState } from "@/lib/validation";
import {
  createPortalUserAction,
  resetPortalPasswordAction,
  revokePortalUserAction,
} from "@/server/actions/portal-access";

export type PortalLogin = {
  id: string;
  name: string;
  email: string;
  /** Also on our team (an admin who is also this client). */
  isMember: boolean;
  /** Pre-formatted "Last signed in …" / "Has not signed in yet". */
  lastSeen: string;
};

function Submit({ label, className }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={className ?? "text-[12.5px]"}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
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
      <Button variant="secondary" size="sm" className="px-2.5 py-[5px]" onClick={() => onChange(generatePassword())}>
        Generate
      </Button>
    </div>
  );
}

function InviteForm({
  clientId,
  defaultName,
  defaultEmail,
  onDone,
}: {
  clientId: string;
  defaultName: string;
  defaultEmail: string;
  onDone: () => void;
}) {
  const [password, setPassword] = useState(generatePassword);
  const [state, formAction] = useActionState<FormState, FormData>(createPortalUserAction, {});

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-2.5 border-b border-l2 bg-hov px-3.5 py-3">
      <input type="hidden" name="clientId" value={clientId} />
      <FormError message={state.error} />
      <Field label="Name" htmlFor="portalName" errors={errors.name} size="sm">
        <Input id="portalName" name="name" size="sm" defaultValue={defaultName} required />
      </Field>
      <Field label="Email" htmlFor="portalEmail" errors={errors.email} size="sm">
        <Input
          id="portalEmail"
          name="email"
          type="email"
          size="sm"
          defaultValue={defaultEmail}
          required
          autoComplete="off"
        />
      </Field>
      <Field
        label="Password"
        htmlFor="portalPassword"
        errors={errors.password}
        size="sm"
        hint="Share it over a channel you trust."
      >
        <PasswordInput id="portalPassword" value={password} onChange={setPassword} />
      </Field>
      <div className="flex gap-2">
        <Submit label="Create login" />
        <Button variant="secondary" className="text-[12.5px]" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ResetForm({ login, onDone }: { login: PortalLogin; onDone: (message: string) => void }) {
  const [password, setPassword] = useState(generatePassword);
  const [state, formAction] = useActionState<FormState, FormData>(resetPortalPasswordAction, {});

  useEffect(() => {
    if (state.ok) onDone(`Password updated. ${login.name} was signed out everywhere.`);
  }, [state.ok, onDone, login.name]);

  return (
    <form action={formAction} className="flex flex-col gap-1.5 rounded-[4px] bg-hov p-2.5">
      <input type="hidden" name="userId" value={login.id} />
      <FormError message={state.error} />
      <PasswordInput id={`reset-${login.id}`} value={password} onChange={setPassword} />
      {state.fieldErrors?.password ? (
        <span className="text-[11.5px] text-red">{state.fieldErrors.password[0]}</span>
      ) : null}
      <span className="text-[11.5px] text-mu">Saving signs them out on every device.</span>
      <div>
        <Submit label="Set password" className="px-2.5 py-[5px] text-[12px]" />
      </div>
    </form>
  );
}

/**
 * The Portal access panel: invite toggle in the header, the client's portal
 * logins below, each with an inline password reset and a revoke button.
 */
export function PortalAccessPanel({
  clientId,
  logins,
  defaultName,
  defaultEmail,
}: {
  clientId: string;
  logins: PortalLogin[];
  defaultName: string;
  defaultEmail: string;
}) {
  const [inviting, setInviting] = useState(false);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const inviteKey = useRef(0);

  return (
    <>
      <CardHeader
        title="Portal access"
        description={
          logins.length === 0 ? "No portal login yet" : `${logins.length} login${logins.length === 1 ? "" : "s"}`
        }
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              inviteKey.current += 1;
              setInviting((value) => !value);
              setResetFor(null);
              setFlash("");
            }}
          >
            Invite to portal
          </Button>
        }
      />
      {inviting ? (
        <InviteForm
          key={inviteKey.current}
          clientId={clientId}
          defaultName={defaultName}
          defaultEmail={defaultEmail}
          onDone={() => setInviting(false)}
        />
      ) : null}
      {logins.length === 0 ? (
        <div className="px-3.5 py-3 text-[12.5px] leading-normal text-mu">
          Invite this client to sign in at /login and see their projects, invoices and files.
        </div>
      ) : (
        logins.map((login) => (
          <div key={login.id} className="flex flex-col gap-1.5 border-b border-l2 px-3.5 py-2.5 last:border-b-0">
            <div className="flex items-center gap-1.5 text-[13px] font-medium">
              {login.name}
              {login.isMember ? (
                <Pill accent className="px-[5px] text-[10.5px] font-medium">
                  Team member
                </Pill>
              ) : null}
            </div>
            <div className="text-[12px] break-all text-mu">{login.email}</div>
            <div className="text-[11.5px] text-fa">{login.lastSeen}</div>
            <div className="flex items-center gap-3">
              {login.isMember ? null : (
                <Button
                  variant="link"
                  onClick={() => {
                    setResetFor((current) => (current === login.id ? null : login.id));
                    setInviting(false);
                    setFlash("");
                  }}
                >
                  Reset password
                </Button>
              )}
              <ConfirmForm
                action={revokePortalUserAction}
                hidden={{ userId: login.id }}
                confirmMessage={
                  login.isMember
                    ? `Remove ${login.email}'s access to this client's portal? Their team account stays.`
                    : `Revoke portal access for ${login.email}? They will no longer be able to sign in.`
                }
                variant="subtle"
              >
                Revoke
              </ConfirmForm>
            </div>
            {resetFor === login.id ? (
              <ResetForm
                login={login}
                onDone={(message) => {
                  setResetFor(null);
                  setFlash(message);
                }}
              />
            ) : null}
          </div>
        ))
      )}
      {flash ? (
        <div className="px-3.5 py-2">
          <FormNotice message={flash} />
        </div>
      ) : null}
    </>
  );
}
