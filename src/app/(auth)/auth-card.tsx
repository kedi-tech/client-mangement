import type { ReactNode } from "react";

/** The bordered card every auth screen sits in. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-[6px] border border-ln bg-pn p-6">{children}</div>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div>
      <h1 className="m-0 text-[20px] font-semibold">{title}</h1>
      {subtitle ? <div className="mt-1 text-[13px] text-mu">{subtitle}</div> : null}
    </div>
  );
}
