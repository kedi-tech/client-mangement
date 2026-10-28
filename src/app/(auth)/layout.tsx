import type { ReactNode } from "react";

/** Centered column for sign-in and sign-up; each page sets its own card. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="box-border grid min-h-screen place-items-center bg-bg p-6">
      <div className="flex w-full max-w-[400px] flex-col gap-5">
        <div className="flex items-center gap-2 text-[16px] font-semibold">
          <span className="size-5 rounded-[5px] bg-ac" aria-hidden />
          KediClient
        </div>
        {children}
      </div>
    </div>
  );
}
